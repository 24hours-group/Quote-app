import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const SESSION_TOKEN_BYTES = 32;
const MINIMUM_TOKEN_LENGTH = 43;

export function generateBookingSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashBookingSessionToken(token) {
  if (typeof token !== 'string' || token.length < MINIMUM_TOKEN_LENGTH) {
    throw new Error('A valid booking session token is required.');
  }

  return `\\x${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

export async function findActiveBookingSessionByToken(token) {
  const accessTokenHash = hashBookingSessionToken(token);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('booking_sessions')
    .select(
      'id, customer_id, current_screen, progress_percent, request_type, expires_at',
    )
    .eq('access_token_hash', accessTokenHash)
    .is('completed_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load the booking session.', { cause: error });
  }

  return data;
}
