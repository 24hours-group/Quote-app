'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchStoredQuote } from '@/features/pricing/services/quoteClient';

export function useAcceptedQuote(quoteId) {
  const [state, setState] = useState({
    status: quoteId ? 'loading' : 'error',
    quote: null,
    error: quoteId ? null : new Error('No accepted quote was selected.'),
  });

  const load = useCallback(async () => {
    if (!quoteId) {
      setState({
        status: 'error',
        quote: null,
        error: new Error('Return to the quote summary and accept a quote.'),
      });
      return;
    }
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const quote = await fetchStoredQuote(quoteId);
      if (quote.status !== 'accepted') {
        throw new Error('The current server quote has not been accepted.');
      }
      setState({ status: 'success', quote, error: null });
    } catch (error) {
      setState({ status: 'error', quote: null, error });
    }
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, retry: load };
}
