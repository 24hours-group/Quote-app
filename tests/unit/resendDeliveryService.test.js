import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/integrations/resend/server', () => ({
  createResendClient: vi.fn(),
}));

import { deliverEmailNotification } from '@/features/notifications/services/resendDeliveryService';

const payload = {
  booking: { reference: 'RS-ABCDEFGH', status: 'succeeded' },
  customer: {
    fullName: 'Maria Santos',
    phoneE164: '+15555550100',
    phoneVerified: false,
  },
  vehicle: { year: 2019, make: 'Honda', model: 'CR-V' },
  service: {
    type: 'tow',
    answers: { neutral: 'yes' },
    specialFlags: { childOrPetInside: 'no' },
    notes: 'Northbound shoulder',
  },
  pickup: {
    address: '1200 N Federal Hwy, Hollywood, FL',
    latitude: 26.021,
    longitude: -80.142,
    landmarks: 'Near the Shell station',
  },
  dropoff: { address: '1000 Biscayne Blvd, Miami, FL' },
  route: { rawMiles: 12.5, billableMiles: 13 },
  quote: {
    currency: 'USD',
    lineItems: [
      {
        description: 'Tow service',
        totalAmountCents: 27300,
        confirmationRequired: false,
      },
    ],
  },
  payment: {
    amountCents: 27300,
    currency: 'USD',
    providerReference: 'pi_test_123',
  },
  company: { name: 'Configured Roadside', supportPhone: '+15550102020' },
};

function notification(templateKey = 'dispatch.booking_paid') {
  return {
    id: '10000000-0000-4000-8000-000000000001',
    recipient: 'dispatch@example.com',
    idempotency_key: 'dispatch:booking-paid:test',
    template_key: templateKey,
    payload,
  };
}

describe('Resend notification delivery', () => {
  it('sends the immutable dispatch payload with provider idempotency', async () => {
    const send = vi.fn().mockResolvedValue({
      data: { id: 'email_resend_123' },
      error: null,
    });
    await expect(
      deliverEmailNotification(notification(), {
        client: { emails: { send } },
        from: 'Roadside <dispatch@verified.example>',
      }),
    ).resolves.toEqual({
      provider: 'resend',
      providerMessageId: 'email_resend_123',
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'Roadside <dispatch@verified.example>',
        to: ['dispatch@example.com'],
        subject: expect.stringContaining('RS-ABCDEFGH'),
        html: expect.stringContaining('Near the Shell station'),
      }),
      { idempotencyKey: 'dispatch:booking-paid:test' },
    );
    expect(send.mock.calls[0][0].html).toContain('>Phone<');
    expect(send.mock.calls[0][0].html).not.toContain('Verified phone');
  });

  it('classifies a provider outage as retryable', async () => {
    const send = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('offline'), { statusCode: 503 }),
      );
    await expect(
      deliverEmailNotification(notification(), {
        client: { emails: { send } },
        from: 'dispatch@verified.example',
      }),
    ).rejects.toMatchObject({ code: 'resend_unavailable', permanent: false });
  });

  it('dead-letters unsupported templates without calling Resend', async () => {
    const send = vi.fn();
    await expect(
      deliverEmailNotification(notification('unknown.template'), {
        client: { emails: { send } },
        from: 'dispatch@verified.example',
      }),
    ).rejects.toMatchObject({ code: 'unsupported_template', permanent: true });
    expect(send).not.toHaveBeenCalled();
  });
});
