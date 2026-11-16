import 'server-only';

import { randomUUID } from 'node:crypto';
import { createRedisClient } from '@/lib/cache/redis';
import { hashBookingSessionToken } from '@/features/booking/repositories/bookingSessionRepository';
import { resolvedLocationSchema } from '@/features/booking/schemas/locationSchema';

const LOCATION_TTL_SECONDS = 2 * 60 * 60;

function locationKey(token, resolutionId) {
  const sessionHash = hashBookingSessionToken(token).slice(2);
  return `booking:location:${sessionHash}:${resolutionId}`;
}

export async function storeResolvedLocation(token, location) {
  const resolved = resolvedLocationSchema.parse({
    ...location,
    resolutionId: randomUUID(),
    resolvedAt: new Date().toISOString(),
  });
  await createRedisClient().set(
    locationKey(token, resolved.resolutionId),
    resolved,
    {
      ex: LOCATION_TTL_SECONDS,
    },
  );
  return resolved;
}

export async function loadResolvedLocation(token, resolutionId) {
  if (!resolutionId) return null;
  const stored = await createRedisClient().get(
    locationKey(token, resolutionId),
  );
  const result = resolvedLocationSchema.safeParse(stored);
  return result.success ? result.data : null;
}
