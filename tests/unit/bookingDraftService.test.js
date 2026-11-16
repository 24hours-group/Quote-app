import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearBookingDraft,
  loadBookingDraft,
  resetBookingDraftServiceForTests,
  saveBookingDraft,
} from '@/features/booking/services/bookingDraftService';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, data }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function errorResponse(code, message, status) {
  return new Response(
    JSON.stringify({ success: false, error: { code, message } }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}

const initialSession = {
  currentScreenId: 'S0',
  answers: {},
  history: [],
  progressPercent: 0,
  version: 0,
};

describe('server-backed booking draft service', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    resetBookingDraftServiceForTests();
    vi.restoreAllMocks();
  });

  it('creates a server session and keeps only a non-sensitive UI marker locally', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(null))
      .mockResolvedValueOnce(jsonResponse(initialSession, 201))
      .mockResolvedValueOnce(
        jsonResponse({
          ...initialSession,
          currentScreenId: 'S1',
          answers: { isSafe: true, fullName: 'Maria Santos' },
          history: ['S0'],
          version: 1,
        }),
      );

    await loadBookingDraft();
    await saveBookingDraft({
      currentScreenId: 'S1',
      answers: { isSafe: true, fullName: 'Maria Santos' },
      history: ['S0'],
    });

    expect(fetch).toHaveBeenNthCalledWith(
      1,
      '/api/booking/session',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      '/api/booking/session',
      expect.objectContaining({ method: 'POST' }),
    );
    const putBody = JSON.parse(fetch.mock.calls[2][1].body);
    expect(putBody).toMatchObject({ currentScreenId: 'S1', version: 0 });

    expect(window.sessionStorage.length).toBe(1);
    const localValue = window.sessionStorage.getItem('roadside-booking-ui-v1');
    expect(localValue).toContain('S1');
    expect(localValue).not.toContain('Maria');
  });

  it('restores the authoritative server draft after a refresh', async () => {
    const restored = {
      currentScreenId: 'S2',
      answers: {
        isSafe: true,
        requestType: 'new',
        fullName: 'Maria Santos',
      },
      history: ['S0', 'S1'],
      progressPercent: 25,
      version: 4,
    };
    global.fetch = vi.fn().mockResolvedValueOnce(jsonResponse(restored));

    const draft = await loadBookingDraft();

    expect(draft).toEqual(restored);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].method).toBe('GET');
  });

  it('serializes concurrent saves with the latest server version', async () => {
    const receivedVersions = [];
    global.fetch = vi.fn(async (_url, options) => {
      if (options.method === 'GET') return jsonResponse(null);
      if (options.method === 'POST') return jsonResponse(initialSession, 201);
      if (options.method === 'PUT') {
        const body = JSON.parse(options.body);
        receivedVersions.push(body.version);
        return jsonResponse({
          currentScreenId: body.currentScreenId,
          answers: body.answers,
          history: body.history,
          progressPercent: 0,
          version: body.version + 1,
        });
      }
      throw new Error(`Unexpected method ${options.method}`);
    });

    await Promise.all([
      saveBookingDraft({
        currentScreenId: 'S0',
        answers: { isSafe: true },
        history: [],
      }),
      saveBookingDraft({
        currentScreenId: 'S1',
        answers: { isSafe: true, requestType: 'new' },
        history: ['S0'],
      }),
    ]);

    expect(receivedVersions).toEqual([0, 1]);
  });

  it('recreates an expired session and retries the current draft once', async () => {
    const restored = { ...initialSession, version: 4 };
    const replacement = { ...initialSession, version: 0 };
    const saved = {
      ...replacement,
      currentScreenId: 'R',
      answers: { handoffReason: 'USER_REQUEST' },
      history: ['S0'],
      version: 1,
    };
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(restored))
      .mockResolvedValueOnce(
        errorResponse(
          'BOOKING_SESSION_NOT_FOUND',
          'The booking session expired.',
          404,
        ),
      )
      .mockResolvedValueOnce(jsonResponse(replacement, 201))
      .mockResolvedValueOnce(jsonResponse(saved));

    await loadBookingDraft();
    await expect(
      saveBookingDraft({
        currentScreenId: 'R',
        answers: { handoffReason: 'USER_REQUEST' },
        history: ['S0'],
      }),
    ).resolves.toEqual(saved);

    expect(fetch.mock.calls.map(([, options]) => options.method)).toEqual([
      'GET',
      'PUT',
      'POST',
      'PUT',
    ]);
    expect(JSON.parse(fetch.mock.calls[3][1].body)).toMatchObject({
      currentScreenId: 'R',
      version: 0,
    });
  });

  it('revokes the active server draft and removes the local marker', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(initialSession))
      .mockResolvedValueOnce(jsonResponse(null));
    await loadBookingDraft();
    window.sessionStorage.setItem(
      'roadside-booking-ui-v1',
      '{"currentScreenId":"S0"}',
    );

    await clearBookingDraft();

    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE' });
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ version: 0 });
    expect(window.sessionStorage.length).toBe(0);
  });
});
