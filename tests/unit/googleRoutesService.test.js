import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env/server', () => ({
  getGoogleMapsServerEnv: () => ({ GOOGLE_MAPS_SERVER_API_KEY: 'server-key' }),
}));

import {
  GoogleRoutesProviderError,
  computeGoogleDrivingRoute,
} from '@/features/booking/services/googleRoutesService';

const pickup = { latitude: 26.021, longitude: -80.142 };
const dropoff = { latitude: 26.122, longitude: -80.242 };

describe('Google Routes provider', () => {
  afterEach(() => vi.restoreAllMocks());

  it('requests only driving route distance, duration, and polyline', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        routes: [
          {
            distanceMeters: 20921,
            duration: '1530.4s',
            polyline: { encodedPolyline: 'encoded-route' },
          },
        ],
      }),
    });

    await expect(
      computeGoogleDrivingRoute({ pickup, dropoff }),
    ).resolves.toEqual({
      distanceMeters: 20921,
      durationSeconds: 1531,
      encodedPolyline: 'encoded-route',
    });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.headers).toMatchObject({
      'X-Goog-Api-Key': 'server-key',
      'X-Goog-FieldMask':
        'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline',
    });
    expect(JSON.parse(options.body)).toMatchObject({
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      origin: {
        location: { latLng: { latitude: 26.021, longitude: -80.142 } },
      },
    });
  });

  it('fails instead of inventing distance when no route is usable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ routes: [] }),
    });

    const request = computeGoogleDrivingRoute({ pickup, dropoff });
    await expect(request).rejects.toMatchObject({
      name: 'GoogleRoutesProviderError',
      code: 'NO_DRIVING_ROUTE',
    });
  });

  it('surfaces provider failures without returning partial route data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ok: false });
    await expect(
      computeGoogleDrivingRoute({ pickup, dropoff }),
    ).rejects.toBeInstanceOf(GoogleRoutesProviderError);
  });
});
