import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

vi.mock('server-only', () => ({}));
vi.mock('@/features/booking/services/bookingSessionCookie', () => ({
  getBookingSessionToken: vi.fn(),
}));
vi.mock('@/features/payment/services/paymentMode', () => ({
  isPaymentSimulationEnabled: vi.fn(),
}));
vi.mock('@/features/payment/services/paymentService', () => ({
  createOrLoadPaymentIntent: vi.fn(),
  PaymentProviderError: class PaymentProviderError extends Error {
    constructor(message = 'Stripe error') {
      super(message);
      this.name = 'PaymentProviderError';
      this.code = 'PAYMENT_PROVIDER_UNAVAILABLE';
    }
  },
}));
vi.mock('@/features/payment/services/simulatedPaymentService', () => ({
  createOrLoadSimulatedPayment: vi.fn(),
}));

import { POST } from '@/app/api/booking/payment/intent/route';
import { getBookingSessionToken } from '@/features/booking/services/bookingSessionCookie';
import { PaymentPersistenceError } from '@/features/payment/repositories/paymentRepository';
import { isPaymentSimulationEnabled } from '@/features/payment/services/paymentMode';
import { createOrLoadPaymentIntent } from '@/features/payment/services/paymentService';
import { createOrLoadSimulatedPayment } from '@/features/payment/services/simulatedPaymentService';

describe('POST /api/booking/payment/intent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getBookingSessionToken.mockReturnValue('session-token-123');
  });

  it('returns 422 when request body is invalid or missing quoteId', async () => {
    const req = new Request('http://localhost:3000/api/booking/payment/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('INVALID_PAYMENT_REQUEST');
  });

  it('returns 500 PAYMENT_CONFIG_ERROR when Stripe environment configuration fails with ZodError', async () => {
    isPaymentSimulationEnabled.mockReturnValue(false);
    createOrLoadPaymentIntent.mockRejectedValueOnce(
      new ZodError([
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['STRIPE_SECRET_KEY'],
          message: 'Required',
        },
      ]),
    );

    const req = new Request('http://localhost:3000/api/booking/payment/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        quoteId: '20000000-0000-4000-8000-000000000002',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe('PAYMENT_CONFIG_ERROR');
    expect(data.error.message).toContain('STRIPE_SECRET_KEY');
  });

  it('returns 422 when the accepted quote is not payable (QUOTE_NOT_PAYABLE)', async () => {
    isPaymentSimulationEnabled.mockReturnValue(false);
    createOrLoadPaymentIntent.mockRejectedValueOnce(
      new PaymentPersistenceError('The accepted quote is no longer payable.', 'QUOTE_NOT_PAYABLE'),
    );

    const req = new Request('http://localhost:3000/api/booking/payment/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        quoteId: '20000000-0000-4000-8000-000000000002',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(422);
    const data = await res.json();
    expect(data.error.code).toBe('QUOTE_NOT_PAYABLE');
  });

  it('returns 500 when an unexpected database persistence error occurs', async () => {
    isPaymentSimulationEnabled.mockReturnValue(false);
    createOrLoadPaymentIntent.mockRejectedValueOnce(
      new PaymentPersistenceError('Database down', 'PAYMENT_UNAVAILABLE'),
    );

    const req = new Request('http://localhost:3000/api/booking/payment/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        quoteId: '20000000-0000-4000-8000-000000000002',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe('PAYMENT_UNAVAILABLE');
  });

  it('returns 201 with intent data on successful creation', async () => {
    isPaymentSimulationEnabled.mockReturnValue(false);
    createOrLoadPaymentIntent.mockResolvedValueOnce({
      paymentId: 'pay-1',
      clientSecret: 'secret_123',
      amountCents: 15000,
      currency: 'USD',
    });

    const req = new Request('http://localhost:3000/api/booking/payment/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        quoteId: '20000000-0000-4000-8000-000000000002',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.paymentId).toBe('pay-1');
    expect(data.data.mode).toBe('stripe');
  });

  it('uses simulation when Stripe is not configured or disabled', async () => {
    isPaymentSimulationEnabled.mockReturnValue(true);
    createOrLoadSimulatedPayment.mockResolvedValueOnce({
      mode: 'simulation',
      paymentId: 'sim-1',
      status: 'pending',
      amountCents: 15000,
      currency: 'USD',
    });

    const req = new Request('http://localhost:3000/api/booking/payment/intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        origin: 'http://localhost:3000',
      },
      body: JSON.stringify({
        quoteId: '20000000-0000-4000-8000-000000000002',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data.mode).toBe('simulation');
    expect(createOrLoadSimulatedPayment).toHaveBeenCalledWith(
      'session-token-123',
      '20000000-0000-4000-8000-000000000002',
    );
  });
});
