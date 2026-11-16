import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHandoffLead } from '@/features/handoff/services/handoffClient';

const responseData = {
  id: 'b0000000-0000-4000-8000-000000000001',
  reasonCode: 'PAY_BY_PHONE',
  assignedTeam: 'Dispatcher',
  priority: 'normal',
  paymentClassification: 'unpaid',
  requestedAction: 'request_callback',
  callbackStatus: 'queued',
  supportPhoneE164: '+15550102020',
  companyName: 'Configured Roadside',
  createdAt: '2026-11-03T10:00:00.000Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('hand-off client', () => {
  it('submits only the reason and requested action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: responseData }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      createHandoffLead({
        reasonCode: 'PAY_BY_PHONE',
        action: 'request_callback',
      }),
    ).resolves.toEqual(responseData);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      reasonCode: 'PAY_BY_PHONE',
      action: 'request_callback',
    });
    expect(fetchMock.mock.calls[0][1].body).not.toMatch(
      /paid|priority|assignedTeam|amount/i,
    );
  });

  it('surfaces a safe retryable API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({
          success: false,
          error: { code: 'HANDOFF_UNAVAILABLE', message: 'Please retry.' },
        }),
      }),
    );
    await expect(
      createHandoffLead({
        reasonCode: 'USER_REQUEST',
        action: 'request_callback',
      }),
    ).rejects.toMatchObject({
      code: 'HANDOFF_UNAVAILABLE',
      message: 'Please retry.',
    });
  });
});
