import { authoritativeQuoteSchema } from '@/features/pricing/schemas/quoteSchema';

const ENDPOINT = '/api/booking/quote';
const pendingQuoteRequests = new Map();
const TRANSIENT_RETRY_DELAY_MS = 250;

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableQuoteError(error) {
  return (
    error?.status >= 500 ||
    error?.code === 'BOOKING_SESSION_CONFLICT' ||
    error?.code === 'QUOTE_UNAVAILABLE'
  );
}

async function parseQuoteResponse(response) {
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || 'The quote request could not be completed.',
    );
    error.code = payload?.error?.code;
    error.status = response.status;
    error.details = payload?.error?.details;
    throw error;
  }
  return authoritativeQuoteSchema.parse(payload.data);
}

async function requestAuthoritativeQuote(body) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: 'POST',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      return await parseQuoteResponse(response);
    } catch (error) {
      if (attempt === 1 || !isRetryableQuoteError(error)) throw error;
      await wait(TRANSIENT_RETRY_DELAY_MS);
    }
  }
  throw new Error('The quote request could not be completed.');
}

export function fetchAuthoritativeQuote(answers) {
  const body = JSON.stringify({ answers });
  const pending = pendingQuoteRequests.get(body);
  if (pending) return pending;

  const request = requestAuthoritativeQuote(body).finally(() =>
    pendingQuoteRequests.delete(body),
  );
  pendingQuoteRequests.set(body, request);
  return request;
}

export function fetchStoredQuote(quoteId) {
  const query = new URLSearchParams({ quoteId });
  return fetch(`${ENDPOINT}?${query}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  }).then(parseQuoteResponse);
}

export function transitionAuthoritativeQuote(quoteId, action) {
  return fetch(ENDPOINT, {
    method: 'PATCH',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId, action }),
  }).then(parseQuoteResponse);
}
