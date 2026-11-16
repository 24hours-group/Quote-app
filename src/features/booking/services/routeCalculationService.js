import 'server-only';

import { routeCalculationRequestSchema } from '@/features/booking/schemas/routeCalculationSchema';
import { computeGoogleDrivingRoute } from '@/features/booking/services/googleRoutesService';
import { loadResolvedLocation } from '@/features/booking/services/locationResolutionStore';
import {
  cacheProviderRoute,
  loadCachedProviderRoute,
  storeRouteSnapshot,
} from '@/features/booking/services/routeCalculationStore';

export class InvalidRouteLocationError extends Error {
  constructor() {
    super('The confirmed pickup or drop-off is no longer available.');
    this.name = 'InvalidRouteLocationError';
  }
}

export async function calculateBookingRoute(token, input) {
  const parsed = routeCalculationRequestSchema.parse(input);
  const [pickup, dropoff] = await Promise.all([
    loadResolvedLocation(token, parsed.pickupResolutionId),
    loadResolvedLocation(token, parsed.dropoffResolutionId),
  ]);
  if (!pickup || !dropoff) throw new InvalidRouteLocationError();

  let providerRoute = await loadCachedProviderRoute(pickup, dropoff);
  if (!providerRoute) {
    providerRoute = await computeGoogleDrivingRoute({ pickup, dropoff });
    await cacheProviderRoute(pickup, dropoff, providerRoute);
  }

  return storeRouteSnapshot(token, parsed, providerRoute);
}
