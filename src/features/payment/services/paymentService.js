import 'server-only';

import { createHash } from 'node:crypto';
import {
  bindPaymentIntent,
  reservePaymentAttempt,
} from '@/features/payment/repositories/paymentRepository';
import { createStripeClient } from '@/lib/integrations/stripe/server';

export class PaymentProviderError extends Error {
  constructor(
    message = 'Stripe payment collection is temporarily unavailable.',
  ) {
    super(message);
    this.name = 'PaymentProviderError';
    this.code = 'PAYMENT_PROVIDER_UNAVAILABLE';
  }
}

export function buildPaymentIdentity({ quoteId, sessionToken }) {
  const idempotencyKey = `payment-intent:${quoteId}:v1`;
  const fingerprint = createHash('sha256')
    .update(`${idempotencyKey}:${sessionToken}`, 'utf8')
    .digest('hex');
  return { idempotencyKey, fingerprint };
}

export async function createOrLoadPaymentIntent(
  token,
  quoteId,
  dependencies = {},
) {
  const stripe = dependencies.stripe || createStripeClient();
  const reserve = dependencies.reserve || reservePaymentAttempt;
  const bind = dependencies.bind || bindPaymentIntent;
  const { idempotencyKey, fingerprint } = buildPaymentIdentity({
    quoteId,
    sessionToken: token,
  });
  const payment = await reserve(token, quoteId, idempotencyKey, fingerprint);

  try {
    const intent = payment.providerPaymentId
      ? await stripe.paymentIntents.retrieve(payment.providerPaymentId)
      : await stripe.paymentIntents.create(
          {
            amount: payment.amountCents,
            currency: payment.currency.toLowerCase(),
            automatic_payment_methods: { enabled: true },
            metadata: {
              payment_id: payment.id,
              quote_id: payment.quoteId,
            },
          },
          { idempotencyKey },
        );

    if (
      intent.amount !== payment.amountCents ||
      intent.currency.toUpperCase() !== payment.currency ||
      !intent.client_secret
    ) {
      throw new PaymentProviderError();
    }

    if (!payment.providerPaymentId) {
      await bind(token, payment.id, intent.id);
    }

    return {
      paymentId: payment.id,
      clientSecret: intent.client_secret,
      status: payment.status,
      amountCents: payment.amountCents,
      currency: payment.currency,
    };
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error;
    throw new PaymentProviderError();
  }
}
