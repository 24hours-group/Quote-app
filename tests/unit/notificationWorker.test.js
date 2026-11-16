import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/features/notifications/repositories/notificationRepository', () => ({
  claimNotifications: vi.fn(),
  markNotificationDelivered: vi.fn(),
  markNotificationFailed: vi.fn(),
}));
vi.mock('@/features/notifications/services/resendDeliveryService', () => ({
  deliverEmailNotification: vi.fn(),
}));

import { NotificationDeliveryError } from '@/features/notifications/services/deliveryError';
import { processNotificationBatch } from '@/features/notifications/services/notificationWorker';

const claimed = {
  id: '10000000-0000-4000-8000-000000000001',
  channel: 'email',
  lease_token: '20000000-0000-4000-8000-000000000002',
};

function dependencies(overrides = {}) {
  return {
    claim: vi.fn().mockResolvedValue([claimed]),
    deliverByChannel: {
      email: vi.fn().mockResolvedValue({
        provider: 'resend',
        providerMessageId: 'email_123',
      }),
    },
    markDelivered: vi.fn().mockResolvedValue({ delivery_status: 'delivered' }),
    markFailed: vi.fn().mockResolvedValue({ delivery_status: 'failed' }),
    ...overrides,
  };
}

describe('durable notification worker', () => {
  it('records successful provider delivery once', async () => {
    const deps = dependencies();
    await expect(processNotificationBatch({}, deps)).resolves.toEqual({
      claimed: 1,
      delivered: 1,
      failed: 0,
      deadLettered: 0,
    });
    expect(deps.markDelivered).toHaveBeenCalledWith(
      claimed,
      'resend',
      'email_123',
    );
    expect(deps.markFailed).not.toHaveBeenCalled();
  });

  it('records retryable provider outages without losing the paid booking', async () => {
    const deps = dependencies({
      deliverByChannel: {
        email: vi
          .fn()
          .mockRejectedValue(
            new NotificationDeliveryError('resend_unavailable'),
          ),
      },
    });
    await expect(processNotificationBatch({}, deps)).resolves.toMatchObject({
      claimed: 1,
      failed: 1,
    });
    expect(deps.markFailed).toHaveBeenCalledWith(
      claimed,
      expect.objectContaining({
        code: 'resend_unavailable',
        permanent: false,
      }),
    );
  });

  it('dead-letters legacy SMS jobs without invoking a provider', async () => {
    const sms = { ...claimed, channel: 'sms' };
    const deps = dependencies({
      claim: vi.fn().mockResolvedValue([sms]),
    });

    await expect(processNotificationBatch({}, deps)).resolves.toMatchObject({
      claimed: 1,
      deadLettered: 1,
    });
    expect(deps.markFailed).toHaveBeenCalledWith(
      sms,
      expect.objectContaining({
        provider: null,
        code: 'unsupported_channel',
        permanent: true,
      }),
    );
  });

  it('does not invoke providers when an idempotent claim returns no rows', async () => {
    const deliver = vi.fn();
    const deps = dependencies({
      claim: vi.fn().mockResolvedValue([]),
      deliverByChannel: { email: deliver },
    });
    await expect(processNotificationBatch({}, deps)).resolves.toMatchObject({
      claimed: 0,
      delivered: 0,
    });
    expect(deliver).not.toHaveBeenCalled();
    expect(deps.markDelivered).not.toHaveBeenCalled();
  });
});
