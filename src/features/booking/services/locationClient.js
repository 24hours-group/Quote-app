import {
  locationResolveRequestSchema,
  resolvedLocationSchema,
} from '@/features/booking/schemas/locationSchema';

const ENDPOINT = '/api/booking/location/resolve';

export class LocationResolutionError extends Error {
  constructor(message, code, status) {
    super(message);
    this.name = 'LocationResolutionError';
    this.code = code;
    this.status = status;
  }
}

export async function resolveBookingLocation(input) {
  const requestBody = locationResolveRequestSchema.parse({
    latitude: input?.latitude,
    longitude: input?.longitude,
    placeId: input?.placeId,
    source: input?.source,
    accuracyMeters: input?.accuracyMeters,
  });
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new LocationResolutionError(
      payload?.error?.message || 'The location could not be confirmed.',
      payload?.error?.code || 'LOCATION_RESOLUTION_FAILED',
      response.status,
    );
  }

  return resolvedLocationSchema.parse(payload.data);
}
