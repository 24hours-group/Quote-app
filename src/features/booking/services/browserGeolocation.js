const GEOLOCATION_MESSAGES = {
  1: 'Location permission was denied. Search for an address instead.',
  2: 'Your current location is unavailable. Search for an address instead.',
  3: 'Finding your location took too long. Try again or search by address.',
};

export class BrowserGeolocationError extends Error {
  constructor(message, code = 'GEOLOCATION_UNAVAILABLE') {
    super(message);
    this.name = 'BrowserGeolocationError';
    this.code = code;
  }
}

export function getCurrentBrowserLocation() {
  if (!globalThis.navigator?.geolocation) {
    return Promise.reject(
      new BrowserGeolocationError(
        'This browser does not support location access. Search by address instead.',
      ),
    );
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracyMeters: coords.accuracy,
        }),
      (error) =>
        reject(
          new BrowserGeolocationError(
            GEOLOCATION_MESSAGES[error.code] ||
              'Your location could not be found. Search by address instead.',
            error.code === 1 ? 'GEOLOCATION_DENIED' : 'GEOLOCATION_UNAVAILABLE',
          ),
        ),
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 },
    );
  });
}
