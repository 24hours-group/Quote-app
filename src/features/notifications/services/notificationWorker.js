import 'server-only';

import {
  claimNotifications,
  markNotificationDelivered,
  markNotificationFailed,
} from '@/features/notifications/repositories/notificationRepository';
import { NotificationDeliveryError } from '@/features/notifications/services/deliveryError';
import { deliverEmailNotification } from '@/features/notifications/services/resendDeliveryService';

const deliveryByChannel = {
  email: deliverEmailNotification,
};

async function processNotification(notification, dependencies) {
  const deliver = dependencies.deliverByChannel[notification.channel];
  if (!deliver) {
    await dependencies.markFailed(notification, {
      provider: null,
      code: 'unsupported_channel',
      permanent: true,
    });
    return { id: notification.id, status: 'dead_letter' };
  }

  try {
    const result = await deliver(notification);
    await dependencies.markDelivered(
      notification,
      result.provider,
      result.providerMessageId,
    );
    return { id: notification.id, status: 'delivered' };
  } catch (error) {
    const deliveryError =
      error instanceof NotificationDeliveryError
        ? error
        : new NotificationDeliveryError('provider_unavailable', {
            cause: error,
          });
    const failed = await dependencies.markFailed(notification, {
      provider: 'resend',
      code: deliveryError.code,
      permanent: deliveryError.permanent,
    });
    return { id: notification.id, status: failed.delivery_status };
  }
}

export async function processNotificationBatch(options = {}, overrides = {}) {
  const dependencies = {
    claim: overrides.claim || claimNotifications,
    markDelivered: overrides.markDelivered || markNotificationDelivered,
    markFailed: overrides.markFailed || markNotificationFailed,
    deliverByChannel: overrides.deliverByChannel || deliveryByChannel,
  };
  const notifications = await dependencies.claim(
    options.batchSize || 20,
    options.leaseSeconds || 60,
  );
  const results = [];
  for (const notification of notifications) {
    results.push(await processNotification(notification, dependencies));
  }
  return {
    claimed: notifications.length,
    delivered: results.filter((result) => result.status === 'delivered').length,
    failed: results.filter((result) => result.status === 'failed').length,
    deadLettered: results.filter((result) => result.status === 'dead_letter')
      .length,
  };
}
