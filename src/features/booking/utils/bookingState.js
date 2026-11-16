import {
  HANDOFF_CODES,
  SCREEN_IDS,
} from '@/features/booking/config/bookingFlow';
import { getNextTransition } from '@/features/booking/utils/bookingFlow';

export const BOOKING_DRAFT_VERSION = 5;

const screenIds = new Set(SCREEN_IDS);
const handoffCodes = new Set(Object.values(HANDOFF_CODES));

const contactAuthorizationFields = ['contactAttached'];
const authoritativeLocationFields = [
  'locationResolutionId',
  'locationAddress',
  'locationPlaceId',
  'locationLatitude',
  'locationLongitude',
  'locationTimezone',
  'locationCountryCode',
  'locationAccuracyMeters',
  'locationSource',
  'locationServiceAreaStatus',
  'locationResolvedAt',
];
const locationFields = [
  ...authoritativeLocationFields,
  'locationStatus',
  'landmarks',
];
const vehicleFields = ['year', 'make', 'model', 'vehicleColor', 'vehicleSize'];
const authoritativeDropoffFields = [
  'dropoffResolutionId',
  'dropoffAddress',
  'dropoffPlaceId',
  'dropoffLatitude',
  'dropoffLongitude',
  'dropoffTimezone',
  'dropoffCountryCode',
  'dropoffServiceAreaStatus',
  'dropoffResolvedAt',
];
const quoteFields = [
  'quoteId',
  'quoteStatus',
  'quotePricingVersion',
  'quoteValidUntil',
  'quoteTotalCents',
];
const terminalFields = [
  ...quoteFields,
  'quoteAction',
  'paymentStatus',
  'handoffReason',
  'handoffFrom',
  'handoffAction',
];
const routeFields = [
  'routeCalculationId',
  'routePickupResolutionId',
  'routeDropoffResolutionId',
  'routeDistanceMeters',
  'routeRawMiles',
  'routeBillableMiles',
  'routeDurationSeconds',
  'routeEncodedPolyline',
  'routeRateBand',
  'routeTravelMode',
  'routeRoutingPreference',
  'routeCalculatedAt',
  'routeExpiresAt',
  'routeStatus',
];
const routeAndTerminalFields = [...routeFields, ...terminalFields];
const serviceFields = [
  'serviceType',
  'resolvedServiceType',
  'batteryCount',
  'tireHandling',
  'damagedTires',
  'tireSize',
  'childOrPetInside',
  ...authoritativeDropoffFields,
  'dropoffStatus',
  'dropoffName',
  'pickupChanged',
  ...routeFields,
  'neutral',
  'fuelType',
  'gallons',
  'mechanicIssue',
  'orientation',
  'distanceFeet',
];
export const PERSISTABLE_ANSWER_KEYS = Object.freeze([
  'isSafe',
  'requestType',
  'fullName',
  'receiptEmail',
  'mobileNumber',
  'contactAttached',
  'bookingReference',
  ...locationFields,
  ...vehicleFields,
  ...serviceFields,
  'customerNotes',
  'editScreenId',
  'editReturnTo',
  'returnTo',
  ...terminalFields,
]);

const persistableAnswerKeys = new Set(PERSISTABLE_ANSWER_KEYS);

const invalidations = {
  requestType: [
    'bookingReference',
    ...locationFields,
    ...vehicleFields,
    ...serviceFields,
    ...terminalFields,
  ],
  fullName: [
    ...contactAuthorizationFields,
    ...locationFields,
    ...vehicleFields,
    ...serviceFields,
    ...terminalFields,
  ],

  receiptEmail: [...contactAuthorizationFields, ...terminalFields],
  mobileNumber: [
    ...contactAuthorizationFields,
    ...locationFields,
    ...vehicleFields,
    ...serviceFields,
    ...terminalFields,
  ],
  locationResolutionId: [
    ...authoritativeLocationFields.filter(
      (field) => field !== 'locationResolutionId',
    ),
    'locationStatus',
    ...routeAndTerminalFields,
  ],
  ...Object.fromEntries(
    authoritativeLocationFields
      .filter((field) => field !== 'locationResolutionId')
      .map((field) => [field, ['locationStatus', ...routeAndTerminalFields]]),
  ),
  locationStatus: routeAndTerminalFields,
  year: [...serviceFields, ...terminalFields],
  make: [...serviceFields, ...terminalFields],
  model: [...serviceFields, ...terminalFields],
  vehicleColor: terminalFields,
  vehicleSize: [...serviceFields, ...terminalFields],
  bookingReference: terminalFields,
  serviceType: serviceFields
    .filter((field) => field !== 'serviceType')
    .concat(terminalFields),
  tireHandling: [
    'resolvedServiceType',
    'damagedTires',
    'tireSize',
    ...authoritativeDropoffFields,
    'dropoffStatus',
    'dropoffName',
    'pickupChanged',
    ...routeFields,
    'neutral',
    ...terminalFields,
  ],
  damagedTires: ['resolvedServiceType', ...terminalFields],
  tireSize: ['resolvedServiceType', ...terminalFields],
  dropoffResolutionId: [
    ...authoritativeDropoffFields.filter(
      (field) => field !== 'dropoffResolutionId',
    ),
    'dropoffStatus',
    ...routeAndTerminalFields,
  ],
  ...Object.fromEntries(
    authoritativeDropoffFields
      .filter((field) => field !== 'dropoffResolutionId')
      .map((field) => [field, ['dropoffStatus', ...routeAndTerminalFields]]),
  ),
  dropoffStatus: routeAndTerminalFields,
  routeCalculationId: [
    ...routeFields.filter((field) => field !== 'routeCalculationId'),
    ...terminalFields,
  ],
  ...Object.fromEntries(
    routeFields
      .filter((field) => !['routeCalculationId', 'routeStatus'].includes(field))
      .map((field) => [field, ['routeStatus', ...terminalFields]]),
  ),
  routeStatus: terminalFields,
  neutral: terminalFields,
  batteryCount: terminalFields,
  childOrPetInside: terminalFields,
  fuelType: ['gallons', ...terminalFields],
  gallons: terminalFields,
  mechanicIssue: terminalFields,
  orientation: ['distanceFeet', ...terminalFields],
  distanceFeet: terminalFields,
  quoteId: [
    'quoteStatus',
    'quotePricingVersion',
    'quoteValidUntil',
    'quoteTotalCents',
    'quoteAction',
    'paymentStatus',
  ],
  quoteStatus: ['quoteAction', 'paymentStatus'],
};

function deleteFields(answers, fields) {
  for (const field of fields) delete answers[field];
}

export function updateBookingAnswer(answers, field, value) {
  const previousValue = answers[field];
  const nextAnswers = { ...answers };

  if (value === undefined) delete nextAnswers[field];
  else nextAnswers[field] = value;

  if (previousValue !== value) {
    deleteFields(nextAnswers, invalidations[field] || []);
  }

  return nextAnswers;
}

export function updateBookingAnswers(answers, updates) {
  return Object.entries(updates).reduce(
    (current, [field, value]) => updateBookingAnswer(current, field, value),
    answers,
  );
}

export function sanitizePersistedAnswers(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers))
    return {};

  return Object.fromEntries(
    Object.entries(answers).filter(
      ([key, value]) =>
        persistableAnswerKeys.has(key) &&
        key !== 'paymentStatus' &&
        value !== undefined,
    ),
  );
}

export function getReachableScreens(answers) {
  const reachable = ['S0'];
  const seenTransitions = new Set();
  let currentScreenId = 'S0';

  for (let index = 0; index < SCREEN_IDS.length * 2; index += 1) {
    const transition = getNextTransition(currentScreenId, answers);
    if (
      !['screen', 'handoff'].includes(transition.type) ||
      !transition.screenId
    ) {
      break;
    }

    const transitionKey = `${currentScreenId}:${transition.screenId}`;
    if (seenTransitions.has(transitionKey)) break;
    seenTransitions.add(transitionKey);

    currentScreenId = transition.screenId;
    reachable.push(currentScreenId);
    if (currentScreenId === 'R') break;
  }

  if (
    answers.handoffReason &&
    handoffCodes.has(answers.handoffReason) &&
    answers.handoffFrom &&
    reachable.includes(answers.handoffFrom) &&
    !reachable.includes('R')
  ) {
    reachable.push('R');
  }

  return reachable;
}

export function normalizeWizardState(draft, trustedAnswers = {}) {
  const answers = {
    ...sanitizePersistedAnswers(draft?.answers),
    ...trustedAnswers,
  };
  const reachable = getReachableScreens(answers);
  const requestedScreenId = screenIds.has(draft?.currentScreenId)
    ? draft.currentScreenId
    : null;
  const currentScreenId = reachable.includes(requestedScreenId)
    ? requestedScreenId
    : reachable.at(-1);
  const history = Array.isArray(draft?.history)
    ? draft.history.filter(
        (screenId) =>
          screenIds.has(screenId) &&
          reachable.includes(screenId) &&
          screenId !== currentScreenId,
      )
    : [];

  return { currentScreenId, answers, history };
}

export function normalizeHistory(history, answers, currentScreenId) {
  const reachable = getReachableScreens(answers);
  return history.filter(
    (screenId) =>
      screenIds.has(screenId) &&
      reachable.includes(screenId) &&
      screenId !== currentScreenId,
  );
}
