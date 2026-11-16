import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export async function broadcastAdminSubmission(eventPayload) {
  try {
    const supabase = createSupabaseAdminClient();
    const channel = supabase.channel('admin-realtime-sync');
    await channel.send({
      type: 'broadcast',
      event: 'submission_sync',
      payload: {
        ...eventPayload,
        timestamp: new Date().toISOString(),
      },
    });
    await supabase.removeChannel(channel);
  } catch (error) {
    // Non-fatal warning: client postgres_changes and fallback polling ensure data sync
    console.warn('Admin realtime broadcast notice (non-fatal):', error?.message);
  }
}

