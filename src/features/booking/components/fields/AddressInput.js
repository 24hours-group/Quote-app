'use client';

import { useEffect, useState } from 'react';
import { Crosshair, LoaderCircle, MapPin } from 'lucide-react';
import { LocationMap } from './LocationMap';
import { TextInput } from './TextInput';
import { usePlacesAutocomplete } from '@/features/booking/hooks/usePlacesAutocomplete';
import { getCurrentBrowserLocation } from '@/features/booking/services/browserGeolocation';
import { resolveBookingLocation } from '@/features/booking/services/locationClient';
import styles from './BookingControls.module.css';

export function AddressInput({
  address,
  latitude,
  longitude,
  locationStatus,
  serviceAreaStatus,
  onLocationChange,
  onLocationClear,
  onConfirm,
  error,
  landmarks,
  onLandmarksChange,
}) {
  const [query, setQuery] = useState(address || '');
  const [isResolving, setIsResolving] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const autocomplete = usePlacesAutocomplete(query === address ? '' : query);

  useEffect(() => {
    if (address) setQuery(address);
  }, [address]);

  async function resolve(input) {
    setIsResolving(true);
    setLocationError(null);
    try {
      const location = await resolveBookingLocation(input);
      setQuery(location.formattedAddress);
      onLocationChange(location);
    } catch (nextError) {
      setLocationError(
        nextError.message || 'The location could not be confirmed.',
      );
    } finally {
      setIsResolving(false);
    }
  }

  const useCurrentLocation = async () => {
    setIsResolving(true);
    setLocationError(null);
    try {
      const coordinates = await getCurrentBrowserLocation();
      await resolve({ ...coordinates, source: 'geolocation' });
    } catch (nextError) {
      setLocationError(
        nextError.message || 'Your location could not be found.',
      );
      setIsResolving(false);
    }
  };

  const selectSuggestion = async (suggestion) => {
    const place = await autocomplete.selectSuggestion(suggestion);
    if (place) await resolve({ ...place, source: 'places' });
  };

  const handleQueryChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setLocationError(null);
    if (address && value !== address) onLocationClear();
  };

  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);
  const isOutsideServiceArea = serviceAreaStatus === 'unavailable';

  return (
    <div className={styles.fieldset}>
      <div className={styles.addressActions}>
        <button
          className={styles.secondaryButton}
          disabled={isResolving}
          onClick={useCurrentLocation}
          type="button"
        >
          {isResolving ? (
            <LoaderCircle className={styles.spin} size={18} />
          ) : (
            <Crosshair size={18} />
          )}
          {isResolving ? 'Finding location…' : 'Use my current location'}
        </button>
      </div>
      <div className={styles.autocomplete}>
        <TextInput
          autoComplete="off"
          error={error}
          id="vehicle-address"
          label="Street address and city"
          onChange={handleQueryChange}
          placeholder="Start typing a US address"
          value={query}
        />
        {autocomplete.status === 'loading' ? (
          <p className={styles.helper}>Searching addresses…</p>
        ) : null}
        {autocomplete.suggestions.length ? (
          <ul
            className={styles.suggestionList}
            aria-label="Address suggestions"
          >
            {autocomplete.suggestions.map((suggestion) => (
              <li key={suggestion.placePrediction.placeId}>
                <button
                  className={styles.suggestionButton}
                  onClick={() => selectSuggestion(suggestion)}
                  type="button"
                >
                  <MapPin aria-hidden="true" size={17} />
                  <span>{suggestion.placePrediction.text.toString()}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {autocomplete.error ? (
        <p className={styles.error} role="alert">
          {autocomplete.error}
        </p>
      ) : null}
      {locationError ? (
        <p className={styles.error} role="alert">
          {locationError}
        </p>
      ) : null}
      <TextInput
        id="location-landmarks"
        label="Landmarks (optional)"
        onChange={(event) => onLandmarksChange(event.target.value)}
        placeholder="Near the Shell station, northbound lane"
        value={landmarks || ''}
      />
      {hasCoordinates ? (
        <LocationMap
          latitude={latitude}
          longitude={longitude}
          onMarkerMoved={(coordinates) =>
            resolve({ ...coordinates, source: 'marker_drag' })
          }
        />
      ) : null}
      {isOutsideServiceArea ? (
        <p className={styles.warning} role="alert">
          This location is outside the currently configured service area.
          Continue to request dispatcher assistance.
        </p>
      ) : null}
      {hasCoordinates && !isOutsideServiceArea ? (
        <button
          className={styles.secondaryButton}
          disabled={isResolving || locationStatus === 'confirmed'}
          onClick={onConfirm}
          type="button"
        >
          <MapPin size={18} />
          {locationStatus === 'confirmed'
            ? 'Vehicle location confirmed'
            : 'Yes, my vehicle is here'}
        </button>
      ) : null}
    </div>
  );
}
