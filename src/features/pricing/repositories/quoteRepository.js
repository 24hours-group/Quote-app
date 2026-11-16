import 'server-only';

import {
  BookingSessionConflictError,
  BookingSessionNotFoundError,
  findActiveBookingSessionByToken,
  hashBookingSessionToken,
} from '@/features/booking/repositories/bookingSessionRepository';
import { authoritativeQuoteSchema } from '@/features/pricing/schemas/quoteSchema';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export class QuotePersistenceError extends Error {
  constructor(cause, stage = 'unknown') {
    super('The authoritative quote could not be saved.', { cause });
    this.name = 'QuotePersistenceError';
    this.stage = stage;
  }
}

export class QuoteLifecycleError extends Error {
  constructor(message, code = 'QUOTE_STATE_CONFLICT') {
    super(message);
    this.name = 'QuoteLifecycleError';
    this.code = code;
  }
}

function publicQuoteStatus(status, validUntil) {
  if (
    ['offered', 'accepted'].includes(status) &&
    Date.parse(validUntil) <= Date.now()
  ) {
    return 'expired';
  }
  if (status === 'offered') return 'active';
  if (status === 'cancelled') return 'declined';
  return status;
}

function throwRpcError(error) {
  if (error?.code === '40001') throw new BookingSessionConflictError();
  if (error?.code === 'P0002') throw new BookingSessionNotFoundError();
  if (error?.code === 'P0003') {
    throw new QuoteLifecycleError(
      'This quote expired. Review the refreshed price before continuing.',
      'QUOTE_EXPIRED',
    );
  }
  if (error?.code === 'P0004' || error?.code === '23514') {
    throw new QuoteLifecycleError(
      'This quote is no longer active. Request a current quote.',
    );
  }
  throw new QuotePersistenceError(error, 'quote_rpc');
}

async function loadStoredQuote(supabase, quoteId) {
  const { data: quote, error } = await supabase
    .from('quotes')
    .select(
      `id, booking_session_id, status, accepted_at, valid_until, pricing_snapshot,
       booking_sessions!inner(
         customer_id,
         customers!inner(full_name, phone_e164, phone_verified_at)
       )`,
    )
    .eq('id', quoteId)
    .single();
  const customer = quote?.booking_sessions?.customers;
  if (error || !quote?.pricing_snapshot?.quote || !customer) {
    throw new QuotePersistenceError(error, 'load_quote_context');
  }

  const snapshot = quote.pricing_snapshot;
  const route = snapshot.route;
  const parsed = authoritativeQuoteSchema.safeParse({
    ...snapshot.quote,
    id: quote.id,
    status: publicQuoteStatus(quote.status, quote.valid_until),
    acceptedAt: quote.accepted_at,
    summary: {
      customer: {
        fullName: customer.full_name,
        phoneE164: customer.phone_e164,
        phoneVerified: Boolean(customer.phone_verified_at),
      },
      vehicle: snapshot.vehicle,
      serviceType:
        snapshot.answers?.resolvedServiceType ||
        snapshot.answers?.serviceType ||
        snapshot.databaseServiceType,
      pickup: snapshot.pickup,
      dropoff: snapshot.dropoff,
      route: route
        ? {
            distanceMeters: route.distanceMeters,
            rawMiles: route.rawMiles,
            billableMiles: route.billableMiles,
            durationSeconds: route.metadata.durationSeconds,
          }
        : null,
    },
    isAuthoritative: true,
  });
  if (!parsed.success) {
    throw new QuotePersistenceError(parsed.error, 'validate_quote_response');
  }
  return parsed.data;
}

export async function expireAuthoritativeQuotesByToken(token) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc('expire_authoritative_quotes', {
    target_access_token_hash: hashBookingSessionToken(token),
  });
  if (error) throwRpcError(error);
}

export async function createAuthoritativeQuoteByToken(
  token,
  expectedVersion,
  requestFingerprint,
  snapshot,
) {
  const supabase = createSupabaseAdminClient();
  const tokenHash = hashBookingSessionToken(token);
  const rpcParams = {
    target_access_token_hash: tokenHash,
    target_expected_version: expectedVersion,
    target_base_fingerprint: `\\x${requestFingerprint}`,
    target_snapshot: snapshot,
  };

  let { data: quoteId, error } = await supabase.rpc(
    'create_authoritative_quote_revision',
    rpcParams,
  );

  if (
    error?.code === '23514' &&
    (error?.message?.includes('accepted quote already exists') ||
      error?.details?.includes('quotes_one_accepted_session_idx'))
  ) {
    const session = await findActiveBookingSessionByToken(token);
    if (session) {
      const { data: acceptedQuotes } = await supabase
        .from('quotes')
        .select('id')
        .eq('booking_session_id', session.id)
        .eq('status', 'accepted');

      for (const accepted of acceptedQuotes || []) {
        const { data: succeededPayments } = await supabase
          .from('payments')
          .select('id')
          .eq('quote_id', accepted.id)
          .eq('status', 'succeeded');

        if (!succeededPayments || succeededPayments.length === 0) {
          await supabase
            .from('quotes')
            .update({ status: 'expired' })
            .eq('id', accepted.id);
        }
      }

      const retryResult = await supabase.rpc(
        'create_authoritative_quote_revision',
        rpcParams,
      );
      quoteId = retryResult.data;
      error = retryResult.error;
    }
  }

  if (error) throwRpcError(error);
  if (!quoteId) {
    throw new QuotePersistenceError(null, 'create_quote_result');
  }
  return loadStoredQuote(supabase, quoteId);
}

export async function transitionAuthoritativeQuoteByToken(
  token,
  quoteId,
  action,
) {
  const supabase = createSupabaseAdminClient();
  const { data: storedQuoteId, error } = await supabase.rpc(
    'transition_authoritative_quote',
    {
      target_access_token_hash: hashBookingSessionToken(token),
      target_quote_id: quoteId,
      target_action: action,
    },
  );
  if (error) throwRpcError(error);
  if (!storedQuoteId) {
    throw new QuotePersistenceError(null, 'transition_quote_result');
  }
  const quote = await loadStoredQuote(supabase, storedQuoteId);
  if (action !== 'load' && quote.status === 'expired') {
    throw new QuoteLifecycleError(
      'This quote expired. Review the refreshed price before continuing.',
      'QUOTE_EXPIRED',
    );
  }
  return quote;
}
