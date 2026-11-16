import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/payment/repositories/paymentRepository', () => ({
  applyStripeEvent: vi.fn(),
  bindPaymentIntent: vi.fn(),
  lookupPaymentStatus: vi.fn(),
  reservePaymentAttempt: vi.fn(),
}));

import {
  completeSimulatedPayment,
  createOrLoadSimulatedPayment,
} from '@/features/payment/services/simulatedPaymentService';

const payment = {
  id: '10000000-0000-4000-8000-000000000001',
  quoteId: '20000000-0000-4000-8000-000000000002',
  providerPaymentId: null,
  amountCents: 27300,
  currency: 'USD',
  status: 'pending',
};

const pendingStatus = {
  paymentId: payment.id,
  status: 'pending',
  amountCents: payment.amountCents,
  currency: payment.currency,
  processedAt: null,
  booking: null,
};

describe('simulated payment service', () => {
  it('reserves the authoritative quote amount and binds a simulated provider id', async () => {
    const reserve = vi.fn().mockResolvedValue(payment);
    const bind = vi.fn().mockResolvedValue({});

    await expect(
      createOrLoadSimulatedPayment('session-token', payment.quoteId, {
        reserve,
        bind,
      }),
    ).resolves.toEqual({
      mode: 'simulation',
      paymentId: payment.id,
      status: 'pending',
      amountCents: 27300,
      currency: 'USD',
    });

    expect(reserve).toHaveBeenCalledWith(
      'session-token',
      payment.quoteId,
      `payment-simulation:${payment.quoteId}:v1`,
      expect.stringMatching(/^[a-f0-9]{64}$/),
    );
    expect(bind).toHaveBeenCalledWith(
      'session-token',
      payment.id,
      `sim_${payment.id}`,
    );
  });

  it('returns an authorized simulation result without recording real payment', async () => {
    const lookup = vi.fn().mockResolvedValue(pendingStatus);

    await expect(
      completeSimulatedPayment('session-token', payment.id, 'success', {
        lookup,
      }),
    ).resolves.toMatchObject({
      ...pendingStatus,
      status: 'succeeded',
      booking: null,
      processedAt: expect.any(String),
    });

    expect(lookup).toHaveBeenCalledOnce();
  });

  it('records simulated failure without reporting money received', async () => {
    const cancelledStatus = { ...pendingStatus, status: 'cancelled' };
    const lookup = vi.fn().mockResolvedValue(pendingStatus);

    await expect(
      completeSimulatedPayment('session-token', payment.id, 'failure', {
        lookup,
      }),
    ).resolves.toEqual(cancelledStatus);
  });
});
