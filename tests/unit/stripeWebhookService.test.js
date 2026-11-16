import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/payment/repositories/paymentRepository', () => ({
  applyStripeEvent: vi.fn(),
}));

import { processStripePaymentEvent } from '@/features/payment/services/stripeWebhookService';

function event(type, overrides = {}) {
  return {
    id: `evt_${type}`,
    type,
    data: {
      object: {
        id: 'pi_test_123',
        amount_received: 15000,
        currency: 'usd',
        ...overrides,
      },
    },
  };
}

describe('Stripe webhook mapping', () => {
  it('maps success with provider-confirmed amount and currency', async () => {
    const apply = vi.fn().mockResolvedValue({ payment_status: 'succeeded' });
    await processStripePaymentEvent(
      event('payment_intent.succeeded'),
      '{"verified":true}',
      apply,
    );
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        providerPaymentId: 'pi_test_123',
        status: 'succeeded',
        amountReceived: 15000,
        currency: 'USD',
      }),
    );
  });

  it('keeps a recoverable card decline reusable as requires action', async () => {
    const apply = vi.fn().mockResolvedValue({});
    await processStripePaymentEvent(
      event('payment_intent.payment_failed'),
      'payload',
      apply,
    );
    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'requires_action',
        amountReceived: null,
      }),
    );
  });

  it('ignores unrelated Stripe events without touching payment persistence', async () => {
    const apply = vi.fn();
    await expect(
      processStripePaymentEvent(event('charge.updated'), 'payload', apply),
    ).resolves.toEqual({ ignored: true });
    expect(apply).not.toHaveBeenCalled();
  });
});
