import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';

function throwIfError(error) {
  if (error) throw new Error('The admin dashboard data is unavailable.');
}

export async function getAdminDashboardData() {
  const supabase = createSupabaseServerClient();
  const [bookingsResult, handoffsResult, notificationsResult, settingsResult] =
    await Promise.all([
      supabase
        .from('bookings')
        .select(
          'id, reference, payment_status, dispatch_status, booked_at, completed_at, cancelled_at, customers(full_name, phone_e164), service_requests(service_type, customer_notes, structured_answers), quotes(total_cents, subtotal_cents, tax_cents, currency, pricing_snapshot), payments(status, amount_cents, currency, provider, provider_payment_id)',
        )
        .order('booked_at', { ascending: false })
        .limit(100),
      supabase
        .from('handoff_leads')
        .select(
          'id, reason_code, assigned_team, callback_status, callback_due_at, resolved_at, collected_details, created_at, customers(full_name, phone_e164)',
        )
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('dispatch_notifications')
        .select(
          'id, event_name, recipient, delivery_status, retry_count, max_attempts, last_error_code, created_at, bookings(reference)',
        )
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('application_settings')
        .select('messages')
        .eq('setting_scope', 'default')
        .maybeSingle(),
    ]);

  throwIfError(bookingsResult.error);
  throwIfError(handoffsResult.error);
  throwIfError(notificationsResult.error);

  const dismissedNotificationIds = new Set(
    Array.isArray(settingsResult?.data?.messages?.dismissed_notifications)
      ? settingsResult.data.messages.dismissed_notifications
      : [],
  );

  const bookings = bookingsResult.data || [];
  const handoffs = (handoffsResult.data || []).filter(
    (h) => !h.collected_details?.is_deleted,
  );
  const notifications = (notificationsResult.data || []).filter(
    (n) => !dismissedNotificationIds.has(n.id),
  );

  const activeDispatches = bookings.filter((b) =>
    ['ready', 'notified', 'acknowledged', 'assigned'].includes(b.dispatch_status),
  ).length;

  const completedCount = bookings.filter((b) => b.dispatch_status === 'completed').length;

  const openHandoffs = handoffs.filter((h) =>
    ['new', 'queued', 'contacted'].includes(h.callback_status),
  ).length;

  const failedNotifications = notifications.filter((n) =>
    ['failed', 'dead_letter'].includes(n.delivery_status),
  ).length;

  return {
    bookings,
    handoffs,
    notifications,
    metrics: {
      totalBookings: bookings.length,
      activeDispatches,
      completedCount,
      openHandoffs,
      failedNotifications,
    },
  };
}
