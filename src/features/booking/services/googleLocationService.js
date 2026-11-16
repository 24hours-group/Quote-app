import 'server-only';

import { applicationConfig } from '@/config/application';
import { locationResolveRequestSchema } from '@/features/booking/schemas/locationSchema';
import { getGoogleMapsServerConfig } from '@/lib/integrations/google-maps/server';

export class GoogleLocationProviderError extends Error {
  constructor(message, code = 'GOOGLE_LOCATION_UNAVAILABLE') {
    super(message);
    this.name = 'GoogleLocationProviderError';
    this.code = code;
  }
}

async function requestGoogleJson(url) {
  const response = await fetch(url, {
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new GoogleLocationProviderError('Google Maps request failed.');
  return response.json();
}

function getCountryCode(result) {
  return result.address_components
    ?.find((component) => component.types?.includes('country'))
    ?.short_name?.toUpperCase();
}

export async function resolveGoogleLocation(input) {
  const parsed = locationResolveRequestSchema.parse(input);
  const config = getGoogleMapsServerConfig();
  const geocodeUrl = new URL(config.geocodingUrl);
  geocodeUrl.searchParams.set('key', config.apiKey);
  if (parsed.placeId) geocodeUrl.searchParams.set('place_id', parsed.placeId);
  else {
    geocodeUrl.searchParams.set(
      'latlng',
      `${parsed.latitude},${parsed.longitude}`,
    );
  }

  const geocode = await requestGoogleJson(geocodeUrl);
  if (geocode.status !== 'OK' || !geocode.results?.[0]) {
    throw new GoogleLocationProviderError(
      'We could not find a street address for that location.',
      'ADDRESS_NOT_FOUND',
    );
  }

  const result = geocode.results[0];
  const latitude = result.geometry?.location?.lat;
  const longitude = result.geometry?.location?.lng;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new GoogleLocationProviderError(
      'Google returned invalid coordinates.',
    );
  }

  const timezoneUrl = new URL(config.timezoneUrl);
  timezoneUrl.searchParams.set('key', config.apiKey);
  timezoneUrl.searchParams.set('location', `${latitude},${longitude}`);
  timezoneUrl.searchParams.set(
    'timestamp',
    String(Math.floor(Date.now() / 1000)),
  );
  const timezone = await requestGoogleJson(timezoneUrl);
  if (timezone.status !== 'OK' || !timezone.timeZoneId) {
    throw new GoogleLocationProviderError(
      'We could not determine the time zone for that location.',
      'TIMEZONE_NOT_FOUND',
    );
  }

  const countryCode = getCountryCode(result);
  if (!countryCode) {
    throw new GoogleLocationProviderError(
      'We could not determine the country for that location.',
      'COUNTRY_NOT_FOUND',
    );
  }
  const allowedCountries = applicationConfig.serviceAvailability.countryCodes;

  return {
    formattedAddress: result.formatted_address,
    placeId: result.place_id,
    latitude,
    longitude,
    timezone: timezone.timeZoneId,
    countryCode,
    serviceAreaStatus: allowedCountries.includes(countryCode)
      ? 'available'
      : 'unavailable',
    source: parsed.source,
    accuracyMeters: parsed.accuracyMeters ?? null,
  };
}
