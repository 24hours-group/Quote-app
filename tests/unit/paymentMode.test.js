import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isPaymentSimulationEnabled } from '@/features/payment/services/paymentMode';

describe('payment mode', () => {
  it('defaults to simulation when Stripe is absent, including in production', () => {
    expect(isPaymentSimulationEnabled({ NODE_ENV: 'development' })).toBe(true);
    expect(isPaymentSimulationEnabled({ NODE_ENV: 'production' })).toBe(true);
  });

  it('allows an explicit override when a Stripe key exists', () => {
    expect(
      isPaymentSimulationEnabled({
        NODE_ENV: 'development',
        PAYMENT_SIMULATION_ENABLED: 'true',
        STRIPE_SECRET_KEY: 'sk_test_configured',
      }),
    ).toBe(true);
    expect(
      isPaymentSimulationEnabled({
        NODE_ENV: 'production',
        PAYMENT_SIMULATION_ENABLED: 'true',
        STRIPE_SECRET_KEY: 'sk_test_configured',
      }),
    ).toBe(true);
  });

  it('uses real payment provider when Stripe key is present and simulation is not forced', () => {
    expect(
      isPaymentSimulationEnabled({
        NODE_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk_test_configured',
      }),
    ).toBe(false);
  });

  it('can be explicitly disabled via environment variable', () => {
    expect(
      isPaymentSimulationEnabled({
        PAYMENT_SIMULATION_ENABLED: 'false',
      }),
    ).toBe(false);
  });
});
