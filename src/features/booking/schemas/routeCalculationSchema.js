import { z } from 'zod';

export const METERS_PER_MILE = 1609.344;
export const TOW_SHORT_RATE_THRESHOLD_MILES = 20;
export const TOW_MAX_MILES = 100;
export const ROUTE_VALIDITY_MINUTES = 15;

export const routeCalculationRequestSchema = z
  .object({
    pickupResolutionId: z.string().uuid(),
    dropoffResolutionId: z.string().uuid(),
  })
  .strict()
  .refine((value) => value.pickupResolutionId !== value.dropoffResolutionId, {
    message: 'Pickup and drop-off must be different locations.',
  });

export const providerRouteSchema = z
  .object({
    distanceMeters: z.number().int().positive(),
    durationSeconds: z.number().int().positive(),
    encodedPolyline: z.string().min(1).max(500000),
  })
  .strict();

export const routeSnapshotSchema = z
  .object({
    routeCalculationId: z.string().uuid(),
    pickupResolutionId: z.string().uuid(),
    dropoffResolutionId: z.string().uuid(),
    distanceMeters: z.number().int().positive(),
    rawMiles: z.number().positive(),
    billableMiles: z.number().int().positive(),
    durationSeconds: z.number().int().positive(),
    encodedPolyline: z.string().min(1).max(500000),
    rateBand: z.enum(['short', 'long']),
    travelMode: z.literal('DRIVE'),
    routingPreference: z.literal('TRAFFIC_UNAWARE'),
    calculatedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
  })
  .strict();

export const AUTHORITATIVE_ROUTE_FIELDS = Object.freeze([
  'routeCalculationId',
  'routePickupResolutionId',
  'routeDropoffResolutionId',
  'routeDistanceMeters',
  'routeRawMiles',
  'routeBillableMiles',
  'routeDurationSeconds',
  'routeEncodedPolyline',
  'routeRateBand',
  'routeTravelMode',
  'routeRoutingPreference',
  'routeCalculatedAt',
  'routeExpiresAt',
]);

export function removeUntrustedRouteSnapshotAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return answers;
  }

  const sanitized = { ...answers };
  for (const field of AUTHORITATIVE_ROUTE_FIELDS) {
    if (field !== 'routeCalculationId') delete sanitized[field];
  }
  return sanitized;
}

export function metersToMiles(distanceMeters) {
  return distanceMeters / METERS_PER_MILE;
}

export function toRouteSnapshot(providerRoute, identifiers, now = new Date()) {
  const rawMiles = metersToMiles(providerRoute.distanceMeters);
  const calculatedAt = now.toISOString();
  const expiresAt = new Date(
    now.getTime() + ROUTE_VALIDITY_MINUTES * 60 * 1000,
  ).toISOString();

  return routeSnapshotSchema.parse({
    routeCalculationId: identifiers.routeCalculationId,
    pickupResolutionId: identifiers.pickupResolutionId,
    dropoffResolutionId: identifiers.dropoffResolutionId,
    distanceMeters: providerRoute.distanceMeters,
    rawMiles,
    billableMiles: Math.ceil(rawMiles),
    durationSeconds: providerRoute.durationSeconds,
    encodedPolyline: providerRoute.encodedPolyline,
    rateBand:
      Math.ceil(rawMiles) <= TOW_SHORT_RATE_THRESHOLD_MILES ? 'short' : 'long',
    travelMode: 'DRIVE',
    routingPreference: 'TRAFFIC_UNAWARE',
    calculatedAt,
    expiresAt,
  });
}

export function isRouteSnapshotFresh(snapshot, now = Date.now()) {
  const parsed = routeSnapshotSchema.safeParse(snapshot);
  return parsed.success && Date.parse(parsed.data.expiresAt) > now;
}

export function toBookingRouteAnswers(snapshot) {
  const parsed = routeSnapshotSchema.parse(snapshot);
  return {
    routeCalculationId: parsed.routeCalculationId,
    routePickupResolutionId: parsed.pickupResolutionId,
    routeDropoffResolutionId: parsed.dropoffResolutionId,
    routeDistanceMeters: parsed.distanceMeters,
    routeRawMiles: parsed.rawMiles,
    routeBillableMiles: parsed.billableMiles,
    routeDurationSeconds: parsed.durationSeconds,
    routeEncodedPolyline: parsed.encodedPolyline,
    routeRateBand: parsed.rateBand,
    routeTravelMode: parsed.travelMode,
    routeRoutingPreference: parsed.routingPreference,
    routeCalculatedAt: parsed.calculatedAt,
    routeExpiresAt: parsed.expiresAt,
  };
}
