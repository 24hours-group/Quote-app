import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/integrations/stripe/server', () => ({
  createStripeClient: vi.fn(),
}));
vi.mock('@/features/payment/repositories/paymentRepository', () => ({
  bindPaymentIntent: vi.fn(),
  reservePaymentAttempt: vi.fn(),
}));

import {
  buildPaymentIdentity,
  createOrLoadPaymentIntent,
} from '@/features/payment/services/paymentService';

const payment = {
  id: '10000000-0000-4000-8000-000000000001',
  quoteId: '20000000-0000-4000-8000-000000000002',
  providerPaymentId: null,
  amountCents: 27300,
  currency: 'USD',
  status: 'pending',
};

function dependencies() {
  return {
    reserve: vi.fn().mockResolvedValue(payment),
    bind: vi.fn().mockResolvedValue({}),
    stripe: {
      paymentIntents: {
        create: vi.fn().mockResolvedValue({
          id: 'pi_test_123',
          amount: 27300,
          currency: 'usd',
          client_secret: 'pi_test_123_secret_test',
        }),
        retrieve: vi.fn(),
      },
    },
  };
}

describe('Stripe Payment Intent service', () => {
  it('uses only the trusted database amount and deterministic idempotency key', async () => {
    const deps = dependencies();
    const result = await createOrLoadPaymentIntent(
      'secure-session-token',
      payment.quoteId,
      deps,
    );

    expect(deps.stripe.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 27300,
        currency: 'usd',
        automatic_payment_methods: { enabled: true },
      }),
      { idempotencyKey: `payment-intent:${payment.quoteId}:v1` },
    );
    expect(deps.bind).toHaveBeenCalledWith(
      'secure-session-token',
      payment.id,
      'pi_test_123',
    );
    expect(result).toMatchObject({ paymentId: payment.id, amountCents: 27300 });
  });

  it('retrieves a previously bound intent after a retry instead of creating another', async () => {
    const deps = dependencies();
    deps.reserve.mockResolvedValue({
      ...payment,
      providerPaymentId: 'pi_existing',
    });
    deps.stripe.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_existing',
      amount: 27300,
      currency: 'usd',
      client_secret: 'pi_existing_secret_test',
    });

    await createOrLoadPaymentIntent(
      'secure-session-token',
      payment.quoteId,
      deps,
    );

    expect(deps.stripe.paymentIntents.retrieve).toHaveBeenCalledWith(
      'pi_existing',
    );
    expect(deps.stripe.paymentIntents.create).not.toHaveBeenCalled();
    expect(deps.bind).not.toHaveBeenCalled();
  });

  it('binds identity to both the quote and session token', () => {
    const first = buildPaymentIdentity({
      quoteId: payment.quoteId,
      sessionToken: 'one',
    });
    const retry = buildPaymentIdentity({
      quoteId: payment.quoteId,
      sessionToken: 'one',
    });
    const otherSession = buildPaymentIdentity({
      quoteId: payment.quoteId,
      sessionToken: 'two',
    });
    expect(first).toEqual(retry);
    expect(first.idempotencyKey).toBe(`payment-intent:${payment.quoteId}:v1`);
    expect(first.fingerprint).not.toBe(otherSession.fingerprint);
  });
});
