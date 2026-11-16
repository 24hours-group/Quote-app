import 'server-only';
import { getGoogleMapsServerEnv } from '@/lib/env/server';

const GOOGLE_ROUTES_API_BASE_URL = 'https://routes.googleapis.com';
const GOOGLE_GEOCODING_API_URL =
  'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_TIMEZONE_API_URL =
  'https://maps.googleapis.com/maps/api/timezone/json';

export function getGoogleMapsServerConfig() {
  const env = getGoogleMapsServerEnv();

  return {
    apiKey: env.GOOGLE_MAPS_SERVER_API_KEY,
    routesBaseUrl: GOOGLE_ROUTES_API_BASE_URL,
    geocodingUrl: GOOGLE_GEOCODING_API_URL,
    timezoneUrl: GOOGLE_TIMEZONE_API_URL,
  };
}
