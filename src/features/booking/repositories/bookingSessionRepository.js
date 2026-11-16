import 'server-only';

import { createHash, randomBytes } from 'node:crypto';
import { BOOKING_DRAFT_VERSION } from '@/features/booking/utils/bookingState';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const SESSION_TOKEN_BYTES = 32;
const MINIMUM_TOKEN_LENGTH = 43;
const SESSION_TTL_MS = 2 * 60 * 60 * 1000;

export class BookingSessionConflictError extends Error {
  constructor() {
    super('The booking session was updated by another request.');
    this.name = 'BookingSessionConflictError';
  }
}

export class BookingSessionNotFoundError extends Error {
  constructor() {
    super('The active booking session was not found.');
    this.name = 'BookingSessionNotFoundError';
  }
}

export class BookingPersistenceConfigurationError extends Error {
  constructor(cause) {
    super('The booking database schema is not up to date.', { cause });
    this.name = 'BookingPersistenceConfigurationError';
  }
}

export function generateBookingSessionToken() {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url');
}

export function hashBookingSessionToken(token) {
  if (typeof token !== 'string' || token.length < MINIMUM_TOKEN_LENGTH) {
    throw new BookingSessionNotFoundError();
  }

  return `\\x${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

function mapSession(row) {
  if (!row) return null;

  return {
    id: row.booking_session_id || row.id,
    customerId: row.customer_id,
    currentScreenId: row.current_screen,
    progressPercent: row.progress_percent,
    flowRequestType: row.flow_request_type,
    draftSchemaVersion: row.draft_schema_version,
    version: Number(row.version),
    expiresAt: row.expires_at,
    updatedAt: row.updated_at,
    ...(row.draft_payload || {}),
  };
}

function throwRepositoryError(error) {
  if (error?.code === '40001') throw new BookingSessionConflictError();
  if (error?.code === 'P0002') throw new BookingSessionNotFoundError();
  if (['PGRST202', '42883', '42501'].includes(error?.code)) {
    throw new BookingPersistenceConfigurationError(error);
  }
  throw new Error('Unable to persist the booking session.', { cause: error });
}

export async function createBookingSession() {
  const token = generateBookingSessionToken();
  const accessTokenHash = hashBookingSessionToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const draftPayload = {
    currentScreenId: 'S0',
    answers: {},
    history: [],
  };
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('booking_sessions')
    .insert({
      access_token_hash: accessTokenHash,
      current_screen: 'S0',
      progress_percent: 0,
      draft_payload: draftPayload,
      draft_schema_version: BOOKING_DRAFT_VERSION,
      expires_at: expiresAt,
    })
    .select(
      'id, customer_id, current_screen, progress_percent, flow_request_type, draft_payload, draft_schema_version, version, expires_at, updated_at',
    )
    .single();

  if (error) throwRepositoryError(error);
  return { token, session: mapSession(data) };
}

export async function findActiveBookingSessionByToken(token) {
  const accessTokenHash = hashBookingSessionToken(token);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('load_booking_draft', {
      target_access_token_hash: accessTokenHash,
    })
    .maybeSingle();

  if (error) throwRepositoryError(error);
  return mapSession(data);
}

export async function findBookingCustomer(customerId) {
  if (!customerId) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('customers')
    .select('id, full_name, receipt_email, phone_e164, phone_verified_at')
    .eq('id', customerId)
    .maybeSingle();

  if (error) throwRepositoryError(error);
  if (!data) return null;
  return {
    id: data.id,
    fullName: data.full_name,
    receiptEmail: data.receipt_email,
    phoneE164: data.phone_e164,
    phoneVerifiedAt: data.phone_verified_at,
  };
}

export async function attachUnverifiedCustomerByToken(token, contact) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('attach_unverified_customer_to_session', {
      target_access_token_hash: hashBookingSessionToken(token),
      expected_version: contact.version,
      target_full_name: contact.fullName,
      target_receipt_email: contact.receiptEmail,
      target_phone: contact.mobileNumber,
      target_sms_consent: false,
    })
    .single();

  if (error) throwRepositoryError(error);
  return {
    sessionId: data.booking_session_id,
    customerId: data.customer_id,
    version: Number(data.session_version),
  };
}

export async function detachBookingCustomerByToken(token, version) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    'detach_booking_customer_from_session',
    {
      target_access_token_hash: hashBookingSessionToken(token),
      expected_version: version,
    },
  );

  if (error) throwRepositoryError(error);
  return Number(data);
}

export async function updateBookingSessionByToken(token, draft) {
  const accessTokenHash = hashBookingSessionToken(token);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .rpc('save_booking_draft', {
      target_access_token_hash: accessTokenHash,
      expected_version: draft.version,
      target_draft_schema_version: draft.draftSchemaVersion,
      target_current_screen: draft.currentScreenId,
      target_progress_percent: draft.progressPercent,
      target_flow_request_type: draft.flowRequestType,
      target_draft_payload: {
        currentScreenId: draft.currentScreenId,
        answers: draft.answers,
        history: draft.history,
      },
    })
    .single();

  if (error) throwRepositoryError(error);
  return mapSession(data);
}

export async function revokeBookingSessionByToken(token, version) {
  const accessTokenHash = hashBookingSessionToken(token);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc('revoke_booking_draft', {
    target_access_token_hash: accessTokenHash,
    expected_version: version,
  });

  if (error) throwRepositoryError(error);
  return Boolean(data);
}
