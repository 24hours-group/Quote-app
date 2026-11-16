import { z } from 'zod';
import { SCREEN_IDS } from '@/features/booking/config/bookingFlow';
import { normalizeUsPhoneNumber } from '@/features/booking/schemas/contactSchema';
import {
  AUTHORITATIVE_DROPOFF_FIELDS,
  AUTHORITATIVE_LOCATION_FIELDS,
  toBookingLocationAnswers,
  toDropoffLocationAnswers,
} from '@/features/booking/schemas/locationSchema';
import {
  AUTHORITATIVE_ROUTE_FIELDS,
  removeUntrustedRouteSnapshotAnswers,
  toBookingRouteAnswers,
} from '@/features/booking/schemas/routeCalculationSchema';
import {
  getNextTransition,
  getStepProgress,
} from '@/features/booking/utils/bookingFlow';
import {
  BOOKING_DRAFT_VERSION,
  getReachableScreens,
  normalizeWizardState,
} from '@/features/booking/utils/bookingState';

const MAX_DRAFT_BYTES = 64 * 1024;
const answerValueSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(100)),
  z.null(),
]);

export const bookingDraftRequestSchema = z
  .object({
    currentScreenId: z.enum(SCREEN_IDS),
    answers: z.record(answerValueSchema),
    history: z.array(z.enum(SCREEN_IDS)).max(64),
    version: z.number().int().nonnegative(),
  })
  .strict();

export class InvalidBookingTransitionError extends Error {
  constructor(details = {}) {
    const cleanReasons = (details.reasons || [])
      .map((r) =>
        typeof r === 'string' && r.includes(': ')
          ? r.split(': ').slice(1).join(': ')
          : r,
      )
      .filter(Boolean);

    let message = '';
    if (cleanReasons.length > 0) {
      message = cleanReasons.join(' ');
    } else if (details.blockedScreen === 'S2') {
      message = 'Save your contact details before continuing.';
    } else if (details.blockedScreen === 'S4') {
      message = 'Please confirm your pickup location before continuing.';
    } else if (details.blockedScreen === 'S5') {
      message = 'Please provide your vehicle details before continuing.';
    } else if (details.blockedScreen === 'S6') {
      message = 'Please select your requested service before continuing.';
    } else if (details.blockedScreen === 'W1') {
      message = 'Please select your destination address before continuing.';
    } else if (details.blockedScreen === 'W2') {
      message = 'Please review your tow route before continuing.';
    } else {
      message = 'Please complete the required details before continuing.';
    }

    super(message);
    this.name = 'InvalidBookingTransitionError';
    this.details = details;
  }
}

function removeUntrustedRouteSnapshotFields(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return input;
  return {
    ...input,
    answers: removeUntrustedRouteSnapshotAnswers(input.answers),
  };
}

function matchesAttachedContact(answers, customer) {
  if (!customer) return false;
  try {
    return (
      normalizeUsPhoneNumber(answers.mobileNumber) === customer.phoneE164 &&
      answers.fullName?.trim() === customer.fullName &&
      answers.receiptEmail?.trim().toLowerCase() === customer.receiptEmail
    );
  } catch {
    return false;
  }
}

function applyTrustedLocation(answers, trustedLocation, trustedDropoff) {
  const nextAnswers = { ...answers };
  const requestedResolutionId = nextAnswers.locationResolutionId;
  for (const field of AUTHORITATIVE_LOCATION_FIELDS) delete nextAnswers[field];

  if (
    trustedLocation &&
    requestedResolutionId === trustedLocation.resolutionId
  ) {
    Object.assign(nextAnswers, toBookingLocationAnswers(trustedLocation));
  } else if (['confirmed', 'pin_moved'].includes(nextAnswers.locationStatus)) {
    delete nextAnswers.locationStatus;
  }

  const requestedDropoffId = nextAnswers.dropoffResolutionId;
  for (const field of AUTHORITATIVE_DROPOFF_FIELDS) delete nextAnswers[field];
  if (trustedDropoff && requestedDropoffId === trustedDropoff.resolutionId) {
    Object.assign(nextAnswers, toDropoffLocationAnswers(trustedDropoff));
  } else if (['confirmed', 'pin_moved'].includes(nextAnswers.dropoffStatus)) {
    delete nextAnswers.dropoffStatus;
  }
  return nextAnswers;
}

function applyTrustedRoute(answers, trustedRoute) {
  const nextAnswers = { ...answers };
  const requestedRouteId = nextAnswers.routeCalculationId;
  const requestedStatus = nextAnswers.routeStatus;
  for (const field of AUTHORITATIVE_ROUTE_FIELDS) delete nextAnswers[field];
  delete nextAnswers.routeStatus;

  if (
    trustedRoute &&
    requestedRouteId === trustedRoute.routeCalculationId &&
    nextAnswers.locationResolutionId === trustedRoute.pickupResolutionId &&
    nextAnswers.dropoffResolutionId === trustedRoute.dropoffResolutionId
  ) {
    Object.assign(nextAnswers, toBookingRouteAnswers(trustedRoute), {
      routeStatus: 'ready',
    });
  } else if (requestedStatus === 'unavailable') {
    nextAnswers.routeStatus = 'unavailable';
  }
  return nextAnswers;
}

export function prepareBookingDraft(
  input,
  customer = null,
  trustedLocation = null,
  trustedDropoff = null,
  trustedRoute = null,
) {
  const parsed = bookingDraftRequestSchema.parse(
    removeUntrustedRouteSnapshotFields(input),
  );
  const locationAnswers = applyTrustedLocation(
    parsed.answers,
    trustedLocation,
    trustedDropoff,
  );
  const answers = applyTrustedRoute(locationAnswers, trustedRoute);
  delete answers.contactAttached;
  const contactMatches = matchesAttachedContact(answers, customer);
  const trustedAnswers = contactMatches
    ? {
        fullName: customer.fullName,
        receiptEmail: customer.receiptEmail,
        mobileNumber: customer.phoneE164,
        contactAttached: true,
      }
    : {};
  const normalized = normalizeWizardState(
    { ...parsed, answers },
    trustedAnswers,
  );

  if (normalized.currentScreenId !== parsed.currentScreenId) {
    const reachable = getReachableScreens(normalized.answers);
    const lastReachable = reachable.at(-1);
    const blockingTransition = getNextTransition(
      lastReachable,
      normalized.answers,
    );
    const reasons =
      blockingTransition?.errors?.map((e) => `${e.field}: ${e.message}`) || [];
    console.error('Invalid booking transition:', {
      requestedScreen: parsed.currentScreenId,
      lastReachableScreen: lastReachable,
      reasons,
      hasCustomer: Boolean(customer),
      contactMatches,
      hasPickup: Boolean(trustedLocation),
      hasDropoff: Boolean(trustedDropoff),
      hasRoute: Boolean(trustedRoute),
    });
    throw new InvalidBookingTransitionError({
      requestedScreen: parsed.currentScreenId,
      blockedScreen: lastReachable,
      reasons,
    });
  }

  const payload = {
    currentScreenId: normalized.currentScreenId,
    answers: normalized.answers,
    history: normalized.history,
  };

  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > MAX_DRAFT_BYTES) {
    throw new RangeError('The booking draft is too large.');
  }

  const progress = getStepProgress(payload.currentScreenId, payload.answers);
  const progressPercent =
    progress.currentStep === null
      ? 100
      : Math.round(
          ((progress.currentStep - 1) / (progress.totalSteps - 1)) * 100,
        );

  return {
    ...payload,
    draftSchemaVersion: BOOKING_DRAFT_VERSION,
    flowRequestType: payload.answers.requestType || null,
    progressPercent,
    version: parsed.version,
    invalidateContact: Boolean(customer && !contactMatches),
  };
}
