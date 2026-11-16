import 'server-only';

import { renderEmail } from '@/features/notifications/templates/emailTemplates';
import {
  NotificationDeliveryError,
  normalizeProviderError,
} from '@/features/notifications/services/deliveryError';
import { createResendClient } from '@/lib/integrations/resend/server';

export async function deliverEmailNotification(notification, integration) {
  try {
    const { client, from } = integration || createResendClient();
    const message = renderEmail(notification);
    const { data, error } = await client.emails.send(
      {
        from,
        to: [notification.recipient],
        subject: message.subject,
        html: message.html,
        text: message.text,
      },
      { idempotencyKey: notification.idempotency_key },
    );
    if (error || !data?.id) {
      throw Object.assign(new Error('Resend rejected delivery.'), error || {});
    }
    return { provider: 'resend', providerMessageId: data.id };
  } catch (error) {
    if (/unsupported email template/i.test(error?.message)) {
      throw new NotificationDeliveryError('unsupported_template', {
        permanent: true,
        cause: error,
      });
    }
    throw normalizeProviderError(error, 'resend');
  }
}
