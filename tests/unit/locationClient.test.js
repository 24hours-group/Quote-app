import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveBookingLocation } from '@/features/booking/services/locationClient';

const resolvedLocation = {
  resolutionId: '3ed90ff8-57b2-49ac-bfb1-675f6d3f95f0',
  formattedAddress: '1200 N Federal Hwy, Hollywood, FL 33020, USA',
  placeId: 'authoritative-place-id',
  latitude: 26.021,
  longitude: -80.142,
  timezone: 'America/New_York',
  countryCode: 'US',
  serviceAreaStatus: 'available',
  source: 'places',
  accuracyMeters: null,
  resolvedAt: '2026-11-02T10:00:00.000Z',
};

describe('location client', () => {
  afterEach(() => vi.restoreAllMocks());

  it('omits the browser display address from a Places resolution request', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: resolvedLocation }),
    });

    await expect(
      resolveBookingLocation({
        placeId: 'browser-place-id',
        formattedAddress: 'Untrusted browser display address',
        latitude: 26.021,
        longitude: -80.142,
        source: 'places',
      }),
    ).resolves.toEqual(resolvedLocation);

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      placeId: 'browser-place-id',
      latitude: 26.021,
      longitude: -80.142,
      source: 'places',
    });
  });
});
