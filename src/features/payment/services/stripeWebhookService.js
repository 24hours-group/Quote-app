import 'server-only';

import { createHash } from 'node:crypto';
import { applyStripeEvent } from '@/features/payment/repositories/paymentRepository';

const statusByEventType = {
  'payment_intent.created': 'pending',
  'payment_intent.processing': 'processing',
  'payment_intent.requires_action': 'requires_action',
  'payment_intent.payment_failed': 'requires_action',
  'payment_intent.canceled': 'cancelled',
  'payment_intent.succeeded': 'succeeded',
};

export function isSupportedPaymentEvent(eventType) {
  return Object.hasOwn(statusByEventType, eventType);
}

export async function processStripePaymentEvent(
  event,
  rawPayload,
  apply = applyStripeEvent,
) {
  if (!isSupportedPaymentEvent(event.type)) return { ignored: true };
  const intent = event.data.object;
  const status = statusByEventType[event.type];
  return apply({
    eventId: event.id,
    eventType: event.type,
    payloadHash: createHash('sha256').update(rawPayload, 'utf8').digest('hex'),
    providerPaymentId: intent.id,
    status,
    amountReceived: status === 'succeeded' ? intent.amount_received : null,
    currency: status === 'succeeded' ? intent.currency.toUpperCase() : null,
  });
}
