'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPaymentStatus } from '@/features/payment/services/paymentClient';

const POLL_INTERVAL_MS = 2000;
const terminalStatuses = new Set([
  'succeeded',
  'failed',
  'cancelled',
  'partially_refunded',
  'refunded',
]);

export function usePaymentStatus(lookup, { poll = false } = {}) {
  const [state, setState] = useState({
    status: 'loading',
    data: null,
    error: null,
  });
  const timer = useRef();
  const paymentId = lookup?.paymentId;
  const reference = lookup?.reference;
  const lookupKey = paymentId || reference;

  const load = useCallback(async () => {
    if (!lookupKey) return;
    try {
      const data = await fetchPaymentStatus({ paymentId, reference });
      setState({ status: 'success', data, error: null });
      return data;
    } catch (error) {
      setState({ status: 'error', data: null, error });
      return null;
    }
  }, [lookupKey, paymentId, reference]);

  useEffect(() => {
    let active = true;
    const run = async () => {
      const data = await load();
      if (active && poll && (!data || !terminalStatuses.has(data.status))) {
        timer.current = window.setTimeout(run, POLL_INTERVAL_MS);
      }
    };
    run();
    return () => {
      active = false;
      window.clearTimeout(timer.current);
    };
  }, [load, poll]);

  return { ...state, retry: load };
}
