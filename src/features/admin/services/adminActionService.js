import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export const VALID_DISPATCH_STATUSES = Object.freeze([
  'ready',
  'notified',
  'acknowledged',
  'assigned',
  'completed',
  'cancelled',
]);

export const VALID_CALLBACK_STATUSES = Object.freeze([
  'new',
  'queued',
  'contacted',
  'resolved',
  'closed',
]);

export async function updateBookingDispatchStatus({
  bookingId,
  dispatchStatus,
}) {
  if (!VALID_DISPATCH_STATUSES.includes(dispatchStatus)) {
    throw new Error(`Invalid dispatch status: ${dispatchStatus}`);
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const patch = {
    dispatch_status: dispatchStatus,
    updated_at: now,
  };

  if (dispatchStatus === 'completed') {
    patch.completed_at = now;
    patch.cancelled_at = null;
  } else if (dispatchStatus === 'cancelled') {
    patch.cancelled_at = now;
    patch.completed_at = null;
  }

  const { data, error } = await supabase
    .from('bookings')
    .update(patch)
    .eq('id', bookingId)
    .select(
      'id, reference, payment_status, dispatch_status, booked_at, completed_at, cancelled_at, customers(full_name, phone_e164)',
    )
    .single();

  if (error) {
    throw new Error(`Failed to update booking dispatch status: ${error.message}`);
  }

  return data;
}

export async function updateHandoffLeadStatus({
  leadId,
  callbackStatus,
  assignedTeam,
}) {
  if (!VALID_CALLBACK_STATUSES.includes(callbackStatus)) {
    throw new Error(`Invalid callback status: ${callbackStatus}`);
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const patch = {
    callback_status: callbackStatus,
    updated_at: now,
  };

  if (assignedTeam !== undefined) {
    patch.assigned_team = assignedTeam ? assignedTeam.trim() : null;
  }

  if (['resolved', 'closed'].includes(callbackStatus)) {
    patch.resolved_at = now;
  } else {
    patch.resolved_at = null;
  }

  const { data, error } = await supabase
    .from('handoff_leads')
    .update(patch)
    .eq('id', leadId)
    .select(
      'id, reason_code, assigned_team, callback_status, callback_due_at, resolved_at, collected_details, created_at, customers(full_name, phone_e164)',
    )
    .single();

  if (error) {
    throw new Error(`Failed to update handoff lead status: ${error.message}`);
  }

  return data;
}

export async function deleteHandoffLead(leadId) {
  if (!leadId) {
    throw new Error('Lead ID is required.');
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: existing, error: fetchError } = await supabase
    .from('handoff_leads')
    .select('id, collected_details')
    .eq('id', leadId)
    .single();

  if (fetchError || !existing) {
    throw new Error('Callback lead not found.');
  }

  const patch = {
    requested_action: 'call_now',
    callback_status: 'closed',
    resolved_at: now,
    closed_at: now,
    collected_details: {
      ...(existing.collected_details || {}),
      is_deleted: true,
      deleted_at: now,
    },
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('handoff_leads')
    .update(patch)
    .eq('id', leadId)
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to delete callback lead: ${error.message}`);
  }

  return { id: data.id, success: true };
}

export async function dismissNotification(notificationId) {
  if (!notificationId) {
    throw new Error('Notification ID is required.');
  }

  const supabase = createSupabaseAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from('dispatch_notifications')
    .select('id')
    .eq('id', notificationId)
    .single();

  if (fetchError || !existing) {
    throw new Error('Notification log not found.');
  }

  const { data: settings } = await supabase
    .from('application_settings')
    .select('id, messages')
    .eq('setting_scope', 'default')
    .maybeSingle();

  const currentMessages = settings?.messages || {};
  const currentDismissed = Array.isArray(currentMessages.dismissed_notifications)
    ? currentMessages.dismissed_notifications
    : [];

  if (!currentDismissed.includes(notificationId)) {
    const updatedDismissed = [...currentDismissed, notificationId];
    const now = new Date().toISOString();

    if (settings?.id) {
      const { error: updateError } = await supabase
        .from('application_settings')
        .update({
          messages: {
            ...currentMessages,
            dismissed_notifications: updatedDismissed,
          },
          updated_at: now,
        })
        .eq('setting_scope', 'default');

      if (updateError) {
        throw new Error(`Failed to dismiss notification: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('application_settings')
        .upsert(
          {
            setting_scope: 'default',
            company_name: 'Townexa',
            support_phone_e164: '+18005550142',
            dispatch_email: 'dispatch@townexa.com',
            default_timezone: 'America/New_York',
            messages: {
              ...currentMessages,
              dismissed_notifications: updatedDismissed,
            },
            updated_at: now,
          },
          { onConflict: 'setting_scope' },
        );

      if (insertError) {
        throw new Error(`Failed to dismiss notification: ${insertError.message}`);
      }
    }
  }

  return { id: notificationId, success: true };
}


