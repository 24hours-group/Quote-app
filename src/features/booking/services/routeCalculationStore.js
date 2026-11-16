import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { createRedisClient } from '@/lib/cache/redis';
import { hashBookingSessionToken } from '@/features/booking/repositories/bookingSessionRepository';
import {
  ROUTE_VALIDITY_MINUTES,
  isRouteSnapshotFresh,
  providerRouteSchema,
  routeSnapshotSchema,
  toRouteSnapshot,
} from '@/features/booking/schemas/routeCalculationSchema';

const ROUTE_TTL_SECONDS = ROUTE_VALIDITY_MINUTES * 60;

function sessionRouteKey(token, routeCalculationId) {
  return `booking:route:${hashBookingSessionToken(token).slice(2)}:${routeCalculationId}`;
}

function providerCacheKey(pickup, dropoff) {
  const coordinates = [
    pickup.latitude.toFixed(6),
    pickup.longitude.toFixed(6),
    dropoff.latitude.toFixed(6),
    dropoff.longitude.toFixed(6),
    'DRIVE',
    'TRAFFIC_UNAWARE',
  ].join(':');
  return `route:provider:${createHash('sha256').update(coordinates).digest('hex')}`;
}

export async function loadCachedProviderRoute(pickup, dropoff) {
  const stored = await createRedisClient().get(
    providerCacheKey(pickup, dropoff),
  );
  const parsed = providerRouteSchema.safeParse(stored);
  return parsed.success ? parsed.data : null;
}

export async function cacheProviderRoute(pickup, dropoff, providerRoute) {
  const parsed = providerRouteSchema.parse(providerRoute);
  await createRedisClient().set(providerCacheKey(pickup, dropoff), parsed, {
    ex: ROUTE_TTL_SECONDS,
  });
}

export async function storeRouteSnapshot(token, identifiers, providerRoute) {
  const snapshot = toRouteSnapshot(providerRoute, {
    ...identifiers,
    routeCalculationId: randomUUID(),
  });
  await createRedisClient().set(
    sessionRouteKey(token, snapshot.routeCalculationId),
    snapshot,
    { ex: ROUTE_TTL_SECONDS },
  );
  return snapshot;
}

export async function loadRouteSnapshot(token, routeCalculationId) {
  if (!routeCalculationId) return null;
  const stored = await createRedisClient().get(
    sessionRouteKey(token, routeCalculationId),
  );
  const parsed = routeSnapshotSchema.safeParse(stored);
  if (!parsed.success || !isRouteSnapshotFresh(parsed.data)) return null;
  return parsed.data;
}
