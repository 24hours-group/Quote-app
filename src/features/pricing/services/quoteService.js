import 'server-only';

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  BookingSessionNotFoundError,
  findActiveBookingSessionByToken,
  findBookingCustomer,
} from '@/features/booking/repositories/bookingSessionRepository';
import { prepareBookingDraft } from '@/features/booking/schemas/bookingSessionSchema';
import { loadResolvedLocation } from '@/features/booking/services/locationResolutionStore';
import { removeUntrustedRouteSnapshotAnswers } from '@/features/booking/schemas/routeCalculationSchema';
import { loadRouteSnapshot } from '@/features/booking/services/routeCalculationStore';
import {
  createAuthoritativeQuoteByToken,
  expireAuthoritativeQuotesByToken,
} from '@/features/pricing/repositories/quoteRepository';
import { loadActivePricingParameters } from '@/features/pricing/repositories/pricingParameterRepository';
import {
  calculateQuote,
  PricingInputError,
} from '@/features/pricing/services/pricingEngine';

const answerValueSchema = z.union([
  z.string().max(2000),
  z.number().finite(),
  z.boolean(),
  z.array(z.string().max(100)),
  z.null(),
]);
export const quoteRequestSchema = z.preprocess(
  (input) => {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      return input;
    return {
      ...input,
      answers: removeUntrustedRouteSnapshotAnswers(input.answers),
    };
  },
  z.object({ answers: z.record(answerValueSchema) }).strict(),
);

const pricingAnswerKeys = [
  'serviceType',
  'resolvedServiceType',
  'batteryCount',
  'tireHandling',
  'damagedTires',
  'tireSize',
  'childOrPetInside',
  'routeCalculationId',
  'routeBillableMiles',
  'routeRateBand',
  'neutral',
  'fuelType',
  'gallons',
  'mechanicIssue',
  'mechanicNotes',
  'orientation',
  'distanceFeet',
  'stuckWheels',
  'dropoffName',
  'customerNotes',
  'landmarks',
];

const databaseServiceTypes = {
  jump_start: 'jump_start',
  flat_tire: 'tire_change',
  tire_change: 'tire_change',
  tire_replace: 'tire_change',
  locked_out: 'lockout',
  lockout: 'lockout',
  tow: 'tow',
  out_of_gas: 'fuel_delivery',
  fuel_delivery: 'fuel_delivery',
  mechanic_check: 'other',
  stuck: 'winch_out',
  winch_out: 'winch_out',
  other: 'other',
};

function selectPricingAnswers(answers) {
  return Object.fromEntries(
    pricingAnswerKeys
      .filter((key) => answers[key] !== undefined)
      .map((key) => [key, answers[key]]),
  );
}

function parameterSnapshot(parameters) {
  return Object.fromEntries(
    Object.entries(parameters).map(([key, parameter]) => [
      key,
      {
        value: parameter.value,
        unit: parameter.unit,
        version: parameter.version,
        effectiveFrom: parameter.effective_from,
        effectiveTo: parameter.effective_to,
      },
    ]),
  );
}

function fingerprint(snapshot, validityMinutes) {
  const window = Math.floor(
    Date.parse(snapshot.quote.pricedAt) / (validityMinutes * 60 * 1000),
  );
  return createHash('sha256')
    .update(
      JSON.stringify({
        sessionId: snapshot.sessionId,
        sessionVersion: snapshot.sessionVersion,
        pricingVersion: snapshot.quote.pricingVersion,
        window,
        vehicle: snapshot.vehicle,
        pickup: snapshot.pickup,
        dropoff: snapshot.dropoff,
        route: snapshot.route,
        serviceType: snapshot.databaseServiceType,
        answers: snapshot.answers,
      }),
    )
    .digest('hex');
}

export async function generateAuthoritativeQuote(token, requestInput) {
  const { answers: requestedAnswers } = quoteRequestSchema.parse(requestInput);
  const session = await findActiveBookingSessionByToken(token);
  if (!session) {
    throw new BookingSessionNotFoundError();
  }

  const locationResolutionId =
    requestedAnswers.locationResolutionId ||
    session.answers?.locationResolutionId;
  const dropoffResolutionId =
    requestedAnswers.dropoffResolutionId ||
    session.answers?.dropoffResolutionId;
  const routeCalculationId =
    requestedAnswers.routeCalculationId ||
    session.answers?.routeCalculationId;

  const pricedAt = new Date();
  const [, customer, pickup, dropoff, route, pricing] = await Promise.all([
    expireAuthoritativeQuotesByToken(token),
    findBookingCustomer(session.customerId),
    loadResolvedLocation(token, locationResolutionId),
    loadResolvedLocation(token, dropoffResolutionId),
    loadRouteSnapshot(token, routeCalculationId),
    loadActivePricingParameters(pricedAt),
  ]);
  if (!customer) {
    throw new PricingInputError(
      'Save the booking contact before requesting a quote.',
      'CONTACT_REQUIRED',
    );
  }

  const draft = prepareBookingDraft(
    {
      currentScreenId: 'S7',
      answers: {
        ...(session.answers || {}),
        ...requestedAnswers,
      },
      history: session.history || [],
      version: session.version,
    },
    customer,
    pickup,
    dropoff,
    route,
  );
  const answers = draft.answers;
  const effectiveServiceType =
    answers.resolvedServiceType || answers.serviceType;
  const databaseServiceType = databaseServiceTypes[effectiveServiceType];
  const isMechanicAssessment =
    effectiveServiceType === 'mechanic_check' ||
    (effectiveServiceType === 'other' && Boolean(answers.mechanicIssue));

  if (
    !databaseServiceType ||
    (effectiveServiceType === 'other' && !isMechanicAssessment)
  ) {
    throw new PricingInputError(
      'This service cannot be priced online.',
      'UNLISTED_SERVICE',
    );
  }

  const quote = calculateQuote({
    answers,
    parameters: pricing.parameters,
    pricingVersion: pricing.version,
    timezone: answers.locationTimezone,
    pricedAt,
  });
  const pricingAnswers = selectPricingAnswers(answers);
  const snapshot = {
    sessionId: session.id,
    sessionVersion: session.version,
    databaseServiceType,
    serviceType: effectiveServiceType,
    vehicle: {
      year: Number(answers.year),
      make: answers.make,
      model: answers.model,
      color: answers.vehicleColor || null,
      isHeavyDuty: answers.vehicleSize === 'heavy',
    },
    pickup: {
      formattedAddress: pickup.formattedAddress,
      placeId: pickup.placeId,
      latitude: pickup.latitude,
      longitude: pickup.longitude,
      timezone: pickup.timezone,
    },
    dropoff: dropoff
      ? {
          formattedAddress: dropoff.formattedAddress,
          placeId: dropoff.placeId,
          latitude: dropoff.latitude,
          longitude: dropoff.longitude,
          timezone: dropoff.timezone,
        }
      : null,
    route: route
      ? {
          calculationId: route.routeCalculationId,
          distanceMeters: route.distanceMeters,
          rawMiles: route.rawMiles,
          billableMiles: route.billableMiles,
          calculatedAt: route.calculatedAt,
          metadata: {
            durationSeconds: route.durationSeconds,
            encodedPolyline: route.encodedPolyline,
            travelMode: route.travelMode,
            routingPreference: route.routingPreference,
          },
        }
      : null,
    answers: {
      ...pricingAnswers,
      serviceType: effectiveServiceType,
    },
    customerNotes: answers.customerNotes || null,
    landmarks: answers.landmarks || null,
    specialFlags: {
      childOrPetInside: answers.childOrPetInside || null,
      heavyDuty: answers.vehicleSize === 'heavy',
    },
    parameterSnapshot: parameterSnapshot(pricing.parameters),
    quote,
  };
  const validityMinutes = pricing.parameters.quote_valid_min.value;
  return createAuthoritativeQuoteByToken(
    token,
    session.version,
    fingerprint(snapshot, validityMinutes),
    snapshot,
  );
}
