import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export class NotificationPersistenceError extends Error {
  constructor(message = 'Notification delivery state is unavailable.') {
    super(message);
    this.name = 'NotificationPersistenceError';
  }
}

function throwOnError(error) {
  if (error) throw new NotificationPersistenceError();
}

export async function claimNotifications(batchSize = 20, leaseSeconds = 60) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('claim_dispatch_notifications', {
    target_batch_size: batchSize,
    target_lease_seconds: leaseSeconds,
  });
  throwOnError(error);
  return data || [];
}

export async function markNotificationDelivered(
  notification,
  provider,
  providerMessageId,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('mark_dispatch_notification_delivered', {
      target_notification_id: notification.id,
      target_lease_token: notification.lease_token,
      target_provider: provider,
      target_provider_message_id: providerMessageId,
    })
    .single();
  throwOnError(error);
  return data;
}

export async function markNotificationFailed(
  notification,
  { provider, code, permanent = false },
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('mark_dispatch_notification_failed', {
      target_notification_id: notification.id,
      target_lease_token: notification.lease_token,
      target_provider: provider,
      target_error_code: code,
      target_permanent: permanent,
    })
    .single();
  throwOnError(error);
  return data;
}
