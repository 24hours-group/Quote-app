'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPaymentIntent } from '@/features/payment/services/paymentClient';

export function usePaymentIntent(quoteId) {
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null,
  });

  const load = useCallback(async () => {
    if (!quoteId) return;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const data = await createPaymentIntent(quoteId);
      setState({ status: 'success', data, error: null });
    } catch (error) {
      setState({ status: 'error', data: null, error });
    }
  }, [quoteId]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, retry: load };
}
