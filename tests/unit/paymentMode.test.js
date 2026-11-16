import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isPaymentSimulationEnabled } from '@/features/payment/services/paymentMode';

describe('payment mode', () => {
  it('defaults to simulation outside production when Stripe is absent', () => {
    expect(isPaymentSimulationEnabled({ NODE_ENV: 'development' })).toBe(true);
  });

  it('allows an explicit local override when a Stripe key exists', () => {
    expect(
      isPaymentSimulationEnabled({
        NODE_ENV: 'development',
        PAYMENT_SIMULATION_ENABLED: 'true',
        STRIPE_SECRET_KEY: 'sk_test_configured',
      }),
    ).toBe(true);
  });

  it('cannot be enabled in production', () => {
    expect(
      isPaymentSimulationEnabled({
        NODE_ENV: 'production',
        PAYMENT_SIMULATION_ENABLED: 'true',
      }),
    ).toBe(false);
  });
});
