'use client';

import { useEffect, useRef, useState } from 'react';
import {
  getGoogleMapsClientConfig,
  loadGoogleMapsLibrary,
} from '@/lib/integrations/google-maps/client';

const DEBOUNCE_MS = 300;

export function usePlacesAutocomplete(query) {
  const [suggestions, setSuggestions] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const tokenRef = useRef(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const input = query.trim();
    if (input.length < 3) {
      setSuggestions([]);
      setStatus('idle');
      setError(null);
      return undefined;
    }

    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(async () => {
      setStatus('loading');
      setError(null);
      try {
        const { AutocompleteSessionToken, AutocompleteSuggestion } =
          await loadGoogleMapsLibrary('places');
        tokenRef.current ||= new AutocompleteSessionToken();
        const { suggestions: nextSuggestions } =
          await AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            includedRegionCodes: [getGoogleMapsClientConfig().country],
            sessionToken: tokenRef.current,
          });
        if (requestId !== requestIdRef.current) return;
        setSuggestions(
          nextSuggestions.filter((item) => item.placePrediction).slice(0, 6),
        );
        setStatus('success');
      } catch {
        if (requestId !== requestIdRef.current) return;
        setSuggestions([]);
        setStatus('error');
        setError(
          'Address suggestions are unavailable. Try your current location.',
        );
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [query]);

  const selectSuggestion = async (suggestion) => {
    setStatus('loading');
    setError(null);
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: ['id', 'formattedAddress', 'location'],
      });
      if (!place.id || !place.formattedAddress || !place.location) {
        throw new Error('Place details are incomplete.');
      }
      tokenRef.current = null;
      setSuggestions([]);
      setStatus('success');
      return {
        placeId: place.id,
        formattedAddress: place.formattedAddress,
        latitude: place.location.lat(),
        longitude: place.location.lng(),
      };
    } catch {
      setStatus('error');
      setError('That address could not be loaded. Choose another result.');
      return null;
    }
  };

  return { error, selectSuggestion, status, suggestions };
}
