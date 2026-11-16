'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { removeUntrustedRouteSnapshotAnswers } from '@/features/booking/schemas/routeCalculationSchema';
import { fetchAuthoritativeQuote } from '@/features/pricing/services/quoteClient';

const FALLBACK_REFRESH_MS = 60 * 1000;
const NON_PRICING_ANSWER_KEYS = new Set([
  'customerNotes',
  'quoteId',
  'quoteStatus',
  'quotePricingVersion',
  'quoteValidUntil',
  'quoteTotalCents',
  'quoteAction',
  'paymentStatus',
]);

export function getQuoteRefreshDelay(quote, now = Date.now()) {
  const validUntil = Date.parse(quote?.validUntil || '');
  const pricedAt = Date.parse(quote?.pricedAt || '');
  const absoluteDelay = validUntil - now;
  if (Number.isFinite(absoluteDelay) && absoluteDelay > 0) return absoluteDelay;

  const serverLifetime = validUntil - pricedAt;
  return Number.isFinite(serverLifetime) && serverLifetime > 0
    ? serverLifetime
    : FALLBACK_REFRESH_MS;
}

export function useAuthoritativeQuote(answers, enabled = true) {
  const requestKey = JSON.stringify(
    Object.fromEntries(
      Object.entries(removeUntrustedRouteSnapshotAnswers(answers)).filter(
        ([key]) => !NON_PRICING_ANSWER_KEYS.has(key),
      ),
    ),
  );
  const requestAnswers = useMemo(() => JSON.parse(requestKey), [requestKey]);
  const [state, setState] = useState({
    status: enabled ? 'loading' : 'idle',
    quote: null,
    error: null,
  });

  const loadQuote = useCallback(async () => {
    if (!enabled) return;
    setState((current) => ({ ...current, status: 'loading', error: null }));
    try {
      const quote = await fetchAuthoritativeQuote(requestAnswers);
      setState({ status: 'success', quote, error: null });
    } catch (error) {
      setState({ status: 'error', quote: null, error });
    }
  }, [enabled, requestAnswers]);

  useEffect(() => {
    loadQuote();
  }, [loadQuote]);

  const quotePricedAt = state.quote?.pricedAt;
  const quoteValidUntil = state.quote?.validUntil;
  useEffect(() => {
    if (state.status !== 'success' || !quoteValidUntil) return undefined;
    const timeout = setTimeout(
      loadQuote,
      getQuoteRefreshDelay({
        pricedAt: quotePricedAt,
        validUntil: quoteValidUntil,
      }),
    );
    return () => clearTimeout(timeout);
  }, [loadQuote, quotePricedAt, quoteValidUntil, state.status]);

  return { ...state, retry: loadQuote };
}
