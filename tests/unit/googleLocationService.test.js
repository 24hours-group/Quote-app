import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env/server', () => ({
  getGoogleMapsServerEnv: () => ({ GOOGLE_MAPS_SERVER_API_KEY: 'server-key' }),
}));

import {
  GoogleLocationProviderError,
  resolveGoogleLocation,
} from '@/features/booking/services/googleLocationService';

const geocodeResult = {
  status: 'OK',
  results: [
    {
      formatted_address: '1200 N Federal Hwy, Hollywood, FL 33020, USA',
      place_id: 'authoritative-place-id',
      geometry: { location: { lat: 26.021, lng: -80.142 } },
      address_components: [{ short_name: 'US', types: ['country'] }],
    },
  ],
};

describe('Google server location resolution', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses provider coordinates, IANA timezone, and configured service area', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({ ok: true, json: async () => geocodeResult })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'OK', timeZoneId: 'America/New_York' }),
      });

    const location = await resolveGoogleLocation({
      placeId: 'browser-place-id',
      latitude: 1,
      longitude: 1,
      source: 'places',
    });

    expect(location).toMatchObject({
      placeId: 'authoritative-place-id',
      latitude: 26.021,
      longitude: -80.142,
      timezone: 'America/New_York',
      countryCode: 'US',
      serviceAreaStatus: 'available',
    });
    expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(fetchMock.mock.calls[0][0].searchParams.get('place_id')).toBe(
      'browser-place-id',
    );
    expect(fetchMock.mock.calls[1][0].searchParams.get('location')).toBe(
      '26.021,-80.142',
    );
  });

  it('marks a provider-validated country outside the service area', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...geocodeResult,
          results: [
            {
              ...geocodeResult.results[0],
              address_components: [{ short_name: 'CA', types: ['country'] }],
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'OK', timeZoneId: 'America/Toronto' }),
      });

    await expect(
      resolveGoogleLocation({
        latitude: 43.65,
        longitude: -79.38,
        source: 'marker_drag',
      }),
    ).resolves.toMatchObject({ serviceAreaStatus: 'unavailable' });
  });

  it('returns a specific failure when reverse geocoding finds no address', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
    });

    const resolution = resolveGoogleLocation({
      latitude: 0,
      longitude: 0,
      source: 'geolocation',
    });
    await expect(resolution).rejects.toBeInstanceOf(
      GoogleLocationProviderError,
    );
  });
});
