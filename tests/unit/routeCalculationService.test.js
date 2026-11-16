import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/booking/services/locationResolutionStore', () => ({
  loadResolvedLocation: vi.fn(),
}));
vi.mock('@/features/booking/services/googleRoutesService', () => ({
  computeGoogleDrivingRoute: vi.fn(),
}));
vi.mock('@/features/booking/services/routeCalculationStore', () => ({
  cacheProviderRoute: vi.fn(),
  loadCachedProviderRoute: vi.fn(),
  storeRouteSnapshot: vi.fn(),
}));

import { computeGoogleDrivingRoute } from '@/features/booking/services/googleRoutesService';
import { loadResolvedLocation } from '@/features/booking/services/locationResolutionStore';
import {
  cacheProviderRoute,
  loadCachedProviderRoute,
  storeRouteSnapshot,
} from '@/features/booking/services/routeCalculationStore';
import {
  InvalidRouteLocationError,
  calculateBookingRoute,
} from '@/features/booking/services/routeCalculationService';

const input = {
  pickupResolutionId: '3ed90ff8-57b2-49ac-bfb1-675f6d3f95f0',
  dropoffResolutionId: 'b08d5dd2-a13b-4097-b5f7-eed513af00e1',
};
const pickup = { latitude: 26.021, longitude: -80.142 };
const dropoff = { latitude: 25.785, longitude: -80.19 };
const providerRoute = {
  distanceMeters: 20117,
  durationSeconds: 1500,
  encodedPolyline: 'encoded-route',
};

describe('booking route calculation service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects missing or cross-session location resolutions', async () => {
    loadResolvedLocation
      .mockResolvedValueOnce(pickup)
      .mockResolvedValueOnce(null);
    await expect(
      calculateBookingRoute('session-token', input),
    ).rejects.toBeInstanceOf(InvalidRouteLocationError);
    expect(computeGoogleDrivingRoute).not.toHaveBeenCalled();
  });

  it('uses a coordinate-only provider cache and stores a session snapshot', async () => {
    loadResolvedLocation
      .mockResolvedValueOnce(pickup)
      .mockResolvedValueOnce(dropoff);
    loadCachedProviderRoute.mockResolvedValue(providerRoute);
    storeRouteSnapshot.mockResolvedValue({ routeCalculationId: 'route-id' });

    await expect(
      calculateBookingRoute('session-token', input),
    ).resolves.toEqual({
      routeCalculationId: 'route-id',
    });
    expect(computeGoogleDrivingRoute).not.toHaveBeenCalled();
    expect(cacheProviderRoute).not.toHaveBeenCalled();
    expect(storeRouteSnapshot).toHaveBeenCalledWith(
      'session-token',
      input,
      providerRoute,
    );
  });

  it('calls Google and populates the cache after a miss', async () => {
    loadResolvedLocation
      .mockResolvedValueOnce(pickup)
      .mockResolvedValueOnce(dropoff);
    loadCachedProviderRoute.mockResolvedValue(null);
    computeGoogleDrivingRoute.mockResolvedValue(providerRoute);
    storeRouteSnapshot.mockResolvedValue({ routeCalculationId: 'route-id' });

    await calculateBookingRoute('session-token', input);
    expect(computeGoogleDrivingRoute).toHaveBeenCalledWith({ pickup, dropoff });
    expect(cacheProviderRoute).toHaveBeenCalledWith(
      pickup,
      dropoff,
      providerRoute,
    );
  });
});
