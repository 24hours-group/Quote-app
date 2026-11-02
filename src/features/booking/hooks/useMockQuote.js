'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchMockQuote } from '@/features/booking/services/mockBookingService';

export function useMockQuote(serviceType, enabled, shouldFail = false) {
  const [state, setState] = useState({
    status: 'idle',
    quote: null,
    error: null,
  });

  const loadQuote = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const quote = await fetchMockQuote({
        serviceType,
        mockQuoteFailure: shouldFail,
      });
      setState({ status: 'success', quote, error: null });
    } catch (error) {
      setState({ status: 'error', quote: null, error });
    }
  }, [enabled, serviceType, shouldFail]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  return { ...state, retry: loadQuote };
}
