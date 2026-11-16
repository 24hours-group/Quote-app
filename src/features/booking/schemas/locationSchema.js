import { z } from 'zod';

const latitudeSchema = z.number().finite().min(-90).max(90);
const longitudeSchema = z.number().finite().min(-180).max(180);

export const locationResolveRequestSchema = z
  .object({
    latitude: latitudeSchema.optional(),
    longitude: longitudeSchema.optional(),
    placeId: z.string().trim().min(1).max(512).optional(),
    source: z.enum(['places', 'geolocation', 'marker_drag']),
    accuracyMeters: z.number().finite().nonnegative().max(100000).optional(),
  })
  .strict()
  .refine(
    (value) =>
      Boolean(value.placeId) ||
      (value.latitude !== undefined && value.longitude !== undefined),
    { message: 'Choose an address or provide valid coordinates.' },
  )
  .refine(
    (value) =>
      (value.latitude === undefined) === (value.longitude === undefined),
    { message: 'Latitude and longitude must be provided together.' },
  );

export const resolvedLocationSchema = z
  .object({
    resolutionId: z.string().uuid(),
    formattedAddress: z.string().trim().min(1).max(1000),
    placeId: z.string().trim().min(1).max(512),
    latitude: latitudeSchema,
    longitude: longitudeSchema,
    timezone: z.string().trim().min(1).max(100),
    countryCode: z.string().length(2),
    serviceAreaStatus: z.enum(['available', 'unavailable']),
    source: z.enum(['places', 'geolocation', 'marker_drag']),
    accuracyMeters: z.number().finite().nonnegative().max(100000).nullable(),
    resolvedAt: z.string().datetime(),
  })
  .strict();

export const AUTHORITATIVE_LOCATION_FIELDS = Object.freeze([
  'locationResolutionId',
  'locationAddress',
  'locationPlaceId',
  'locationLatitude',
  'locationLongitude',
  'locationTimezone',
  'locationCountryCode',
  'locationAccuracyMeters',
  'locationSource',
  'locationServiceAreaStatus',
  'locationResolvedAt',
]);

export const AUTHORITATIVE_DROPOFF_FIELDS = Object.freeze([
  'dropoffResolutionId',
  'dropoffAddress',
  'dropoffPlaceId',
  'dropoffLatitude',
  'dropoffLongitude',
  'dropoffTimezone',
  'dropoffCountryCode',
  'dropoffServiceAreaStatus',
  'dropoffResolvedAt',
]);

export function toBookingLocationAnswers(location) {
  const parsed = resolvedLocationSchema.parse(location);
  return {
    locationResolutionId: parsed.resolutionId,
    locationAddress: parsed.formattedAddress,
    locationPlaceId: parsed.placeId,
    locationLatitude: parsed.latitude,
    locationLongitude: parsed.longitude,
    locationTimezone: parsed.timezone,
    locationCountryCode: parsed.countryCode,
    locationAccuracyMeters: parsed.accuracyMeters,
    locationSource: parsed.source,
    locationServiceAreaStatus: parsed.serviceAreaStatus,
    locationResolvedAt: parsed.resolvedAt,
  };
}

export function toDropoffLocationAnswers(location) {
  const parsed = resolvedLocationSchema.parse(location);
  return {
    dropoffResolutionId: parsed.resolutionId,
    dropoffAddress: parsed.formattedAddress,
    dropoffPlaceId: parsed.placeId,
    dropoffLatitude: parsed.latitude,
    dropoffLongitude: parsed.longitude,
    dropoffTimezone: parsed.timezone,
    dropoffCountryCode: parsed.countryCode,
    dropoffServiceAreaStatus: parsed.serviceAreaStatus,
    dropoffResolvedAt: parsed.resolvedAt,
  };
}
