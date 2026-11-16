import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPaymentIntent,
  fetchPaymentStatus,
  simulatePayment,
} from '@/features/payment/services/paymentClient';

const intent = {
  paymentId: '10000000-0000-4000-8000-000000000001',
  clientSecret: 'pi_test_secret',
  status: 'pending',
  amountCents: 15000,
  currency: 'USD',
};

afterEach(() => vi.unstubAllGlobals());

describe('payment client', () => {
  it('sends only the accepted quote identifier when creating an intent', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: intent }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await createPaymentIntent('20000000-0000-4000-8000-000000000002');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/booking/payment/intent',
      expect.objectContaining({
        body: JSON.stringify({
          quoteId: '20000000-0000-4000-8000-000000000002',
        }),
      }),
    );
    expect(fetchMock.mock.calls[0][1].body).not.toContain('amount');
  });

  it('submits only a payment identifier and simulation outcome', async () => {
    const status = {
      paymentId: intent.paymentId,
      status: 'cancelled',
      amountCents: 15000,
      currency: 'USD',
      processedAt: null,
      booking: null,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: status }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(simulatePayment(intent.paymentId, 'failure')).resolves.toEqual(
      status,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/booking/payment/simulate',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          paymentId: intent.paymentId,
          outcome: 'failure',
        }),
      }),
    );
  });

  it('looks up status through the secure same-origin endpoint', async () => {
    const status = {
      paymentId: intent.paymentId,
      status: 'succeeded',
      amountCents: 15000,
      currency: 'USD',
      processedAt: '2026-11-03T12:00:00.000Z',
      booking: {
        id: '30000000-0000-4000-8000-000000000003',
        reference: 'RS-ABCDEFGH',
        dispatchStatus: 'ready',
      },
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: status }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      fetchPaymentStatus({ paymentId: intent.paymentId }),
    ).resolves.toEqual(status);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/booking/payment/status?paymentId=${intent.paymentId}`,
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });
});
