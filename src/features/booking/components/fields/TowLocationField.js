'use client';

import { useEffect, useState } from 'react';
import { LoaderCircle, MapPin } from 'lucide-react';
import { TextInput } from './TextInput';
import { usePlacesAutocomplete } from '@/features/booking/hooks/usePlacesAutocomplete';
import { resolveBookingLocation } from '@/features/booking/services/locationClient';
import styles from './BookingControls.module.css';

export function TowLocationField({ address, error, onClear, onResolved }) {
  const [query, setQuery] = useState(address || '');
  const [isResolving, setIsResolving] = useState(false);
  const [resolutionError, setResolutionError] = useState(null);
  const autocomplete = usePlacesAutocomplete(query === address ? '' : query);

  useEffect(() => {
    if (address) setQuery(address);
  }, [address]);

  const handleChange = (event) => {
    const value = event.target.value;
    setQuery(value);
    setResolutionError(null);
    if (address && value !== address) onClear();
  };

  const chooseSuggestion = async (suggestion) => {
    const place = await autocomplete.selectSuggestion(suggestion);
    if (!place) return;
    setIsResolving(true);
    setResolutionError(null);
    try {
      const location = await resolveBookingLocation({
        ...place,
        source: 'places',
      });
      setQuery(location.formattedAddress);
      onResolved(location);
    } catch (nextError) {
      setResolutionError(
        nextError.message || 'The drop-off could not be confirmed.',
      );
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className={styles.autocomplete}>
      <TextInput
        autoComplete="off"
        error={error}
        id="dropoff-address"
        label="Drop-off address"
        onChange={handleChange}
        placeholder="Start typing a US address"
        value={query}
      />
      {autocomplete.status === 'loading' || isResolving ? (
        <p className={styles.helper}>
          <LoaderCircle className={styles.spin} size={16} /> Searching
          addresses…
        </p>
      ) : null}
      {autocomplete.suggestions.length ? (
        <ul
          className={styles.suggestionList}
          aria-label="Drop-off address suggestions"
        >
          {autocomplete.suggestions.map((suggestion) => (
            <li key={suggestion.placePrediction.placeId}>
              <button
                className={styles.suggestionButton}
                onClick={() => chooseSuggestion(suggestion)}
                type="button"
              >
                <MapPin aria-hidden="true" size={17} />
                <span>{suggestion.placePrediction.text.toString()}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {autocomplete.error || resolutionError ? (
        <p className={styles.error} role="alert">
          {resolutionError || autocomplete.error}
        </p>
      ) : null}
    </div>
  );
}
