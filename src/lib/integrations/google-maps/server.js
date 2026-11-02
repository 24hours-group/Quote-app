import 'server-only';
import { getGoogleMapsServerEnv } from '@/lib/env/server';

const GOOGLE_MAPS_API_BASE_URL = 'https://routes.googleapis.com';

export function getGoogleMapsServerConfig() {
  const env = getGoogleMapsServerEnv();

  return {
    apiKey: env.GOOGLE_MAPS_SERVER_API_KEY,
    routesBaseUrl: GOOGLE_MAPS_API_BASE_URL,
  };
}
