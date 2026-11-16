import { importLibrary, setOptions } from '@googlemaps/js-api-loader';
import { getClientEnv } from '@/lib/env/client';

let configured = false;
let invalidMapIdWarningShown = false;

export function isValidGoogleMapId(value) {
  return value === 'DEMO_MAP_ID' || /^[0-9a-f]{16}$/i.test(value || '');
}

function configureGoogleMaps() {
  if (configured) return;
  const env = getClientEnv();
  if (!env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps is not configured.');
  }

  setOptions({
    key: env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    v: 'weekly',
  });
  configured = true;
}

export async function loadGoogleMapsLibrary(name) {
  configureGoogleMaps();
  return importLibrary(name);
}

export function getGoogleMapsClientConfig() {
  const env = getClientEnv();
  const configuredMapId = env.NEXT_PUBLIC_GOOGLE_MAP_ID;
  const fallbackMapId =
    process.env.NODE_ENV === 'production' ? undefined : 'DEMO_MAP_ID';
  const candidate = configuredMapId || fallbackMapId;

  if (
    configuredMapId &&
    !isValidGoogleMapId(configuredMapId) &&
    !invalidMapIdWarningShown
  ) {
    console.warn(
      'NEXT_PUBLIC_GOOGLE_MAP_ID must be a 16-character hexadecimal Google Cloud Map ID. Falling back to the standard map.',
    );
    invalidMapIdWarningShown = true;
  }

  return {
    country: env.NEXT_PUBLIC_GOOGLE_MAPS_COUNTRY,
    mapId: isValidGoogleMapId(candidate) ? candidate : undefined,
  };
}
