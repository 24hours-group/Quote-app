import 'server-only';

import {
  BookingSessionNotFoundError,
  createBookingSession,
  detachBookingCustomerByToken,
  findActiveBookingSessionByToken,
  findBookingCustomer,
  revokeBookingSessionByToken,
  updateBookingSessionByToken,
} from '@/features/booking/repositories/bookingSessionRepository';
import { prepareBookingDraft } from '@/features/booking/schemas/bookingSessionSchema';
import { loadResolvedLocation } from '@/features/booking/services/locationResolutionStore';
import { loadRouteSnapshot } from '@/features/booking/services/routeCalculationStore';

export function toClientBookingSession(session, customer = null) {
  if (!session) return null;

  const answers = { ...(session.answers || {}) };
  delete answers.verificationCode;
  delete answers.codeStatus;
  delete answers.codeAttempts;
  delete answers.textConsent;
  if (customer) {
    answers.fullName = customer.fullName;
    answers.receiptEmail = customer.receiptEmail;
    answers.mobileNumber = customer.phoneE164;
    answers.contactAttached = true;
  } else {
    delete answers.contactAttached;
  }

  return {
    currentScreenId: session.currentScreenId,
    answers,
    history: session.history || [],
    progressPercent: session.progressPercent,
    version: session.version,
    expiresAt: session.expiresAt,
    updatedAt: session.updatedAt,
  };
}

export async function startBookingSession() {
  const created = await createBookingSession();
  return {
    token: created.token,
    session: toClientBookingSession(created.session),
  };
}

export async function restoreBookingSession(token) {
  const session = await findActiveBookingSessionByToken(token);
  const customer = await findBookingCustomer(session?.customerId);
  return toClientBookingSession(session, customer);
}

export async function persistBookingSession(token, input) {
  const session = await findActiveBookingSessionByToken(token);
  if (!session) {
    throw new BookingSessionNotFoundError();
  }
  const [customer, trustedLocation, trustedDropoff, trustedRoute] =
    await Promise.all([
      findBookingCustomer(session.customerId),
      loadResolvedLocation(token, input?.answers?.locationResolutionId),
      loadResolvedLocation(token, input?.answers?.dropoffResolutionId),
      loadRouteSnapshot(token, input?.answers?.routeCalculationId),
    ]);
  const draft = prepareBookingDraft(
    input,
    customer,
    trustedLocation,
    trustedDropoff,
    trustedRoute,
  );
  if (draft.invalidateContact) {
    draft.version = await detachBookingCustomerByToken(token, draft.version);
  }
  const savedSession = await updateBookingSessionByToken(token, draft);
  return toClientBookingSession(
    savedSession,
    draft.invalidateContact ? null : customer,
  );
}

export async function endBookingSession(token, version) {
  return revokeBookingSessionByToken(token, version);
}
