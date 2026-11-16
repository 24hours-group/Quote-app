import 'server-only';

import {
  BookingSessionNotFoundError,
  findActiveBookingSessionByToken,
  hashBookingSessionToken,
} from '@/features/booking/repositories/bookingSessionRepository';
import { handoffLeadSchema } from '@/features/handoff/schemas/handoffSchema';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export class HandoffPersistenceError extends Error {
  constructor(message = 'The hand-off request could not be saved.') {
    super(message);
    this.name = 'HandoffPersistenceError';
  }
}

export class HandoffActionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'HandoffActionError';
  }
}

export class HandoffContactRequiredError extends Error {
  constructor() {
    super('Add your contact details before requesting a callback.');
    this.name = 'HandoffContactRequiredError';
  }
}

function throwRpcError(error) {
  if (
    error?.code === 'P0002' &&
    error?.message?.includes('Active booking session not found')
  ) {
    throw new BookingSessionNotFoundError();
  }
  if (error?.code === 'P0002') {
    throw new HandoffPersistenceError('Hand-off routing is not configured.');
  }
  if (error?.code === '23514' || error?.code === '22023') {
    throw new HandoffActionError(
      'That hand-off option is not available for this request.',
    );
  }
  throw new HandoffPersistenceError();
}

export async function createHandoffLeadByToken(token, input) {
  const session = await findActiveBookingSessionByToken(token);
  if (!session) throw new BookingSessionNotFoundError();
  if (
    session.currentScreenId !== 'R' ||
    session.answers?.handoffReason !== input.reasonCode
  ) {
    throw new HandoffActionError(
      'That hand-off option does not match the saved request.',
    );
  }
  if (input.action === 'request_callback' && !session.customerId) {
    throw new HandoffContactRequiredError();
  }
  if (
    input.reasonCode === 'EXISTING_JOB' &&
    (session.flowRequestType !== 'existing' ||
      !/^RS-[A-Z0-9]{8,20}$/.test(session.answers?.bookingReference || ''))
  ) {
    throw new HandoffActionError('A valid booking reference is required.');
  }
  if (
    input.reasonCode === 'CANCEL_JOB' &&
    (session.flowRequestType !== 'cancel' ||
      !/^RS-[A-Z0-9]{8,20}$/.test(session.answers?.bookingReference || ''))
  ) {
    throw new HandoffActionError('A valid booking reference is required.');
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('create_handoff_lead_by_session', {
    target_access_token_hash: hashBookingSessionToken(token),
    target_reason_code: input.reasonCode,
    target_action: input.action,
  });
  if (error) throwRpcError(error);
  if (!data) throw new HandoffPersistenceError();
  return handoffLeadSchema.parse(data);
}
