import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/env/server', () => ({
  getStripeServerEnv: vi.fn(() => ({ STRIPE_WEBHOOK_SECRET: 'whsec_test' })),
}));
vi.mock('@/lib/integrations/stripe/server', () => ({
  createStripeClient: vi.fn(),
}));
vi.mock('@/features/payment/services/stripeWebhookService', () => ({
  processStripePaymentEvent: vi.fn(),
}));

import { POST } from '@/app/api/webhooks/stripe/route';
import { processStripePaymentEvent } from '@/features/payment/services/stripeWebhookService';
import { createStripeClient } from '@/lib/integrations/stripe/server';

const verifiedEvent = {
  id: 'evt_verified',
  type: 'payment_intent.succeeded',
};

describe('Stripe webhook route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createStripeClient.mockReturnValue({
      webhooks: { constructEvent: vi.fn(() => verifiedEvent) },
    });
    processStripePaymentEvent.mockResolvedValue({
      payment_status: 'succeeded',
    });
  });

  it('rejects an invalid Stripe signature before processing', async () => {
    createStripeClient.mockReturnValue({
      webhooks: {
        constructEvent: vi.fn(() => {
          throw new Error('bad signature');
        }),
      },
    });
    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'invalid' },
        body: '{"id":"evt_untrusted"}',
      }),
    );
    expect(response.status).toBe(400);
    expect(processStripePaymentEvent).not.toHaveBeenCalled();
  });

  it('acknowledges an idempotently processed verified delivery', async () => {
    const response = await POST(
      new Request('http://localhost/api/webhooks/stripe', {
        method: 'POST',
        headers: { 'stripe-signature': 'valid' },
        body: '{"id":"evt_verified"}',
      }),
    );
    expect(response.status).toBe(200);
    expect(processStripePaymentEvent).toHaveBeenCalledWith(
      verifiedEvent,
      '{"id":"evt_verified"}',
    );
  });
});
