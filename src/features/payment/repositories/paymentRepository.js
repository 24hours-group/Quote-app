import 'server-only';

import { hashBookingSessionToken } from '@/features/booking/repositories/bookingSessionRepository';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export class PaymentPersistenceError extends Error {
  constructor(
    message = 'Payment persistence is temporarily unavailable.',
    code,
  ) {
    super(message);
    this.name = 'PaymentPersistenceError';
    this.code = code;
  }
}

function throwRepositoryError(error) {
  if (error?.code === 'P0002') {
    throw new PaymentPersistenceError(
      'The authorized payment or booking was not found.',
      'PAYMENT_NOT_FOUND',
    );
  }
  if (error?.code === 'P0003' || error?.code === '23514') {
    throw new PaymentPersistenceError(
      'The accepted quote is no longer payable.',
      'QUOTE_NOT_PAYABLE',
    );
  }
  if (error?.code === '23505' || error?.code === '23000') {
    throw new PaymentPersistenceError(
      'The payment request conflicts with an existing attempt.',
      'PAYMENT_CONFLICT',
    );
  }
  throw new PaymentPersistenceError();
}

function mapStatus(row) {
  return {
    paymentId: row.payment_id,
    status: row.payment_status,
    amountCents: row.amount_cents,
    currency: row.currency,
    processedAt: row.processed_at,
    booking: row.booking_id
      ? {
          id: row.booking_id,
          reference: row.booking_reference,
          dispatchStatus: row.dispatch_status,
        }
      : null,
  };
}

export async function reservePaymentAttempt(
  token,
  quoteId,
  idempotencyKey,
  fingerprint,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('reserve_session_payment_attempt', {
      target_access_token_hash: hashBookingSessionToken(token),
      target_quote_id: quoteId,
      request_key: idempotencyKey,
      fingerprint: `\\x${fingerprint}`,
    })
    .single();
  if (error || !data) throwRepositoryError(error);
  return {
    id: data.id,
    quoteId: data.quote_id,
    providerPaymentId: data.provider_payment_id,
    amountCents: data.amount_cents,
    currency: data.currency,
    status: data.status,
  };
}

export async function bindPaymentIntent(token, paymentId, providerPaymentId) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('bind_session_payment_provider_id', {
      target_access_token_hash: hashBookingSessionToken(token),
      target_payment_id: paymentId,
      target_provider_payment_id: providerPaymentId,
    })
    .single();
  if (error || !data) throwRepositoryError(error);
  return data;
}

export async function applyStripeEvent({
  eventId,
  eventType,
  payloadHash,
  providerPaymentId,
  status,
  amountReceived,
  currency,
}) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('apply_stripe_payment_event', {
      target_provider_event_id: eventId,
      target_event_type: eventType,
      target_payload_hash: `\\x${payloadHash}`,
      target_provider_payment_id: providerPaymentId,
      target_payment_status: status,
      target_amount_received: amountReceived,
      target_currency: currency,
    })
    .single();
  if (error || !data) throwRepositoryError(error);
  return data;
}

export async function lookupPaymentStatus(token, { paymentId, reference }) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('lookup_session_payment_status', {
      target_access_token_hash: hashBookingSessionToken(token),
      target_payment_id: paymentId || null,
      target_booking_reference: reference || null,
    })
    .single();
  if (error || !data) throwRepositoryError(error);
  return mapStatus(data);
}
