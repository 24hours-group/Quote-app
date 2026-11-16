import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCurrentBrowserLocation } from '@/features/booking/services/browserGeolocation';

describe('browser geolocation', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns coordinates and reported accuracy', async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({
        coords: { latitude: 26.021, longitude: -80.142, accuracy: 14 },
      }),
    );
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });

    await expect(getCurrentBrowserLocation()).resolves.toEqual({
      latitude: 26.021,
      longitude: -80.142,
      accuracyMeters: 14,
    });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true }),
    );
  });

  it('returns an actionable permission-denied error', async () => {
    vi.stubGlobal('navigator', {
      geolocation: {
        getCurrentPosition: (_success, failure) => failure({ code: 1 }),
      },
    });

    await expect(getCurrentBrowserLocation()).rejects.toMatchObject({
      code: 'GEOLOCATION_DENIED',
      message: expect.stringMatching(/permission was denied/i),
    });
  });
});
