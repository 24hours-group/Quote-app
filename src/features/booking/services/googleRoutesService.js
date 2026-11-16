import 'server-only';

import { getGoogleMapsServerConfig } from '@/lib/integrations/google-maps/server';

const ROUTE_FIELD_MASK =
  'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline';

export class GoogleRoutesProviderError extends Error {
  constructor(message, code = 'ROUTES_PROVIDER_UNAVAILABLE') {
    super(message);
    this.name = 'GoogleRoutesProviderError';
    this.code = code;
  }
}

function parseDurationSeconds(duration) {
  const match = /^(\d+(?:\.\d+)?)s$/.exec(duration || '');
  if (!match)
    throw new GoogleRoutesProviderError(
      'Google returned an invalid route duration.',
    );
  return Math.ceil(Number(match[1]));
}

export async function computeGoogleDrivingRoute({ pickup, dropoff }) {
  const config = getGoogleMapsServerConfig();
  const response = await fetch(
    `${config.routesBaseUrl}/directions/v2:computeRoutes`,
    {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.apiKey,
        'X-Goog-FieldMask': ROUTE_FIELD_MASK,
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: pickup.latitude,
              longitude: pickup.longitude,
            },
          },
        },
        destination: {
          location: {
            latLng: {
              latitude: dropoff.latitude,
              longitude: dropoff.longitude,
            },
          },
        },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes: false,
        units: 'IMPERIAL',
      }),
    },
  );

  if (!response.ok) {
    throw new GoogleRoutesProviderError(
      'Google Routes could not calculate this trip.',
    );
  }
  const payload = await response.json();
  const route = payload.routes?.[0];
  if (
    !Number.isInteger(route?.distanceMeters) ||
    route.distanceMeters <= 0 ||
    !route?.polyline?.encodedPolyline
  ) {
    throw new GoogleRoutesProviderError(
      'No usable driving route was found between these locations.',
      'NO_DRIVING_ROUTE',
    );
  }

  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: parseDurationSeconds(route.duration),
    encodedPolyline: route.polyline.encodedPolyline,
  };
}
