import {
  paymentIntentResponseSchema,
  paymentStatusSchema,
} from '@/features/payment/schemas/paymentSchema';

async function parseResponse(response, schema) {
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(
      payload?.error?.message || 'The payment request could not be completed.',
    );
    error.code = payload?.error?.code;
    error.status = response.status;
    throw error;
  }
  return schema.parse(payload.data);
}

export function createPaymentIntent(quoteId) {
  return fetch('/api/booking/payment/intent', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quoteId }),
  }).then((response) => parseResponse(response, paymentIntentResponseSchema));
}

export function simulatePayment(paymentId, outcome) {
  return fetch('/api/booking/payment/simulate', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentId, outcome }),
  }).then((response) => parseResponse(response, paymentStatusSchema));
}

export function fetchPaymentStatus({ paymentId, reference }) {
  const query = new URLSearchParams(paymentId ? { paymentId } : { reference });
  return fetch(`/api/booking/payment/status?${query}`, {
    method: 'GET',
    cache: 'no-store',
    credentials: 'same-origin',
  }).then((response) => parseResponse(response, paymentStatusSchema));
}
