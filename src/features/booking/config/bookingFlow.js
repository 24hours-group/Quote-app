export const SCREEN_IDS = Object.freeze([
  'S0',
  'S1',
  'S2',
  'S4',
  'S5',
  'S6',
  'J1',
  'T1',
  'L1',
  'W1',
  'W2',
  'G1',
  'M1',
  'X1',
  'S7',
  'S8A',
  'R',
]);

export const HANDOFF_CODES = Object.freeze({
  USER_REQUEST: 'USER_REQUEST',
  EXISTING_JOB: 'EXISTING_JOB',
  CANCEL_JOB: 'CANCEL_JOB',
  MISSING_INFO: 'MISSING_INFO',
  HEAVY_DUTY: 'HEAVY_DUTY',
  UNLISTED_SERVICE: 'UNLISTED_SERVICE',
  WINCH_SPECIALIST: 'WINCH_SPECIALIST',
  OVER_LIMIT: 'OVER_LIMIT',
  PAY_BY_PHONE: 'PAY_BY_PHONE',
});

export const SERVICE_SCREEN_IDS = Object.freeze({
  jump_start: 'J1',
  flat_tire: 'T1',
  locked_out: 'L1',
  tow: 'W1',
  out_of_gas: 'G1',
  mechanic_check: 'M1',
  stuck: 'X1',
});

export const QUOTE_EDIT_SCREEN_IDS = Object.freeze([
  'S2',
  'S4',
  'S5',
  'S6',
  'J1',
  'T1',
  'L1',
  'W1',
  'W2',
  'G1',
  'M1',
  'X1',
]);

const required = (field, message, when) => ({ field, message, when });
const transition = (when, to, extra = {}) => ({ when, to, ...extra });

export const screenConfigs = Object.freeze({
  S0: {
    id: 'S0',
    title: 'Safety check',
    step: 1,
    required: [required('isSafe', 'Tell us whether you are in a safe place.')],
    transitions: [
      transition({ field: 'isSafe', eq: true }, 'S1'),
      transition({ field: 'isSafe', eq: false }, 'S1', {
        noticeCode: 'CALL_911',
      }),
    ],
  },
  S1: {
    id: 'S1',
    title: 'Entry',
    step: 2,
    required: [required('requestType', 'Choose how we can help.')],
    transitions: [
      transition(
        { field: 'requestType', in: ['new', 'existing', 'cancel'] },
        'S2',
      ),
    ],
  },
  S2: {
    id: 'S2',
    title: 'Contact and phone check',
    step: 3,
    required: [
      required('fullName', 'Enter your first and last name.'),
      required('mobileNumber', 'Enter a valid US mobile number.'),
      required(
        'textConsent',
        'Consent is required to send invoice and job texts.',
      ),
      required('codeStatus', 'Enter and verify the 6-digit code.'),
    ],
    validations: [
      {
        field: 'fullName',
        rule: 'fullName',
        message: 'Enter your first and last name.',
      },
      {
        field: 'mobileNumber',
        rule: 'usMobile',
        message: 'Enter a valid US mobile number.',
      },
      {
        field: 'textConsent',
        rule: 'true',
        message: 'Consent is required to send invoice and job texts.',
      },
    ],
    transitions: [
      transition(
        {
          all: [
            { field: 'codeStatus', eq: 'failed' },
            { field: 'codeAttempts', gte: 3 },
          ],
        },
        'R',
        { reasonCode: HANDOFF_CODES.MISSING_INFO },
      ),
      transition(
        {
          all: [
            { field: 'codeStatus', eq: 'verified' },
            { field: 'requestType', eq: 'new' },
          ],
        },
        'S4',
      ),
      transition(
        {
          all: [
            { field: 'codeStatus', eq: 'verified' },
            { field: 'requestType', in: ['existing', 'cancel'] },
          ],
        },
        'S5',
      ),
    ],
  },
  S4: {
    id: 'S4',
    title: 'Vehicle location',
    step: 4,
    required: [
      required('locationStatus', 'Find an address and confirm its map pin.'),
    ],
    transitions: [
      transition({ field: 'locationStatus', eq: 'unavailable' }, 'R', {
        reasonCode: HANDOFF_CODES.MISSING_INFO,
      }),
      transition({ field: 'locationStatus', eq: 'not_found' }, 'S4', {
        type: 'validation',
        code: 'ADDRESS_NOT_FOUND',
        message:
          "We couldn't find that address. Add the city or a cross street.",
      }),
      transition({ field: 'locationStatus', eq: 'pin_moved' }, 'S4', {
        type: 'validation',
        code: 'PIN_CONFIRMATION_REQUIRED',
        message: 'Confirm the updated address and map pin.',
      }),
      transition({ field: 'locationStatus', eq: 'confirmed' }, 'S5', {
        allowEditReturn: true,
      }),
    ],
  },
  S5: {
    id: 'S5',
    title: 'Vehicle',
    step: 5,
    required: [
      required('year', 'Enter the vehicle year.'),
      required('make', 'Enter the vehicle make.'),
      required('model', 'Enter the vehicle model.'),
      required('vehicleSize', 'Answer the vehicle size question.'),
    ],
    transitions: [
      transition({ field: 'vehicleSize', eq: 'unknown' }, 'R', {
        reasonCode: HANDOFF_CODES.MISSING_INFO,
      }),
      transition({ field: 'vehicleSize', eq: 'heavy' }, 'R', {
        reasonCode: HANDOFF_CODES.HEAVY_DUTY,
      }),
      transition(
        {
          all: [
            { field: 'vehicleSize', eq: 'regular' },
            { field: 'requestType', eq: 'existing' },
          ],
        },
        'R',
        { reasonCode: HANDOFF_CODES.EXISTING_JOB },
      ),
      transition(
        {
          all: [
            { field: 'vehicleSize', eq: 'regular' },
            { field: 'requestType', eq: 'cancel' },
          ],
        },
        'R',
        { reasonCode: HANDOFF_CODES.CANCEL_JOB },
      ),
      transition(
        {
          all: [
            { field: 'vehicleSize', eq: 'regular' },
            { field: 'requestType', eq: 'new' },
          ],
        },
        'S6',
        { allowEditReturn: true },
      ),
    ],
  },
  S6: {
    id: 'S6',
    title: 'Service choice',
    step: 6,
    required: [required('serviceType', 'Choose a roadside service.')],
    transitions: [
      ...Object.entries(SERVICE_SCREEN_IDS).map(([serviceType, screenId]) =>
        transition({ field: 'serviceType', eq: serviceType }, screenId),
      ),
      transition({ field: 'serviceType', eq: 'other' }, 'R', {
        reasonCode: HANDOFF_CODES.UNLISTED_SERVICE,
      }),
    ],
  },
  J1: {
    id: 'J1',
    title: 'Jump start',
    step: 7,
    required: [
      required('batteryCount', 'Choose how many batteries need a jump.'),
    ],
    transitions: [
      transition({ field: 'batteryCount', gt: 4 }, 'R', {
        reasonCode: HANDOFF_CODES.OVER_LIMIT,
      }),
      transition({ field: 'batteryCount', between: [1, 4] }, 'S7', {
        allowEditReturn: true,
      }),
    ],
  },
  T1: {
    id: 'T1',
    title: 'Flat tire',
    step: 7,
    required: [
      required('tireHandling', 'Choose how the tire should be handled.'),
      required('damagedTires', 'Choose how many tires are damaged.', {
        field: 'tireHandling',
        in: ['spare', 'replacement'],
      }),
      required('tireSize', 'Enter the tire size.', {
        field: 'tireHandling',
        eq: 'replacement',
      }),
    ],
    transitions: [
      transition({ field: 'tireHandling', eq: 'tow' }, 'W1', {
        serviceType: 'tow',
      }),
      transition(
        {
          all: [
            { field: 'tireHandling', in: ['spare', 'replacement'] },
            { field: 'damagedTires', gte: 2 },
          ],
        },
        'R',
        { reasonCode: HANDOFF_CODES.OVER_LIMIT },
      ),
      transition(
        {
          all: [
            { field: 'tireHandling', eq: 'spare' },
            { field: 'damagedTires', eq: 1 },
          ],
        },
        'S7',
        { allowEditReturn: true, serviceType: 'tire_change' },
      ),
      transition(
        {
          all: [
            { field: 'tireHandling', eq: 'replacement' },
            { field: 'damagedTires', eq: 1 },
            { field: 'tireSize', present: true },
          ],
        },
        'S7',
        { allowEditReturn: true, serviceType: 'tire_replace' },
      ),
    ],
  },
  L1: {
    id: 'L1',
    title: 'Lockout',
    step: 7,
    required: [
      required('childOrPetInside', 'Answer the child or pet safety question.'),
    ],
    transitions: [
      transition({ field: 'childOrPetInside', eq: false }, 'S7', {
        allowEditReturn: true,
      }),
      transition({ field: 'childOrPetInside', eq: true }, 'S7', {
        allowEditReturn: true,
        noticeCode: 'CALL_911',
        jobFlags: ['urgent'],
      }),
    ],
  },
  W1: {
    id: 'W1',
    title: 'Tow pickup and drop-off',
    step: 7,
    substep: { current: 1, total: 2 },
    required: [
      required('dropoffAddress', 'Enter where you want the vehicle towed.'),
    ],
    transitions: [
      transition({ field: 'pickupChanged', eq: true }, 'S4', {
        returnTo: 'W1',
        bypassValidation: true,
      }),
      transition({ field: 'dropoffAddress', present: true }, 'W2'),
    ],
  },
  W2: {
    id: 'W2',
    title: 'Tow miles and neutral',
    step: 7,
    substep: { current: 2, total: 2 },
    required: [
      required('towMiles', 'Enter the distance in miles.'),
      required('neutral', 'Tell us whether the vehicle can be put in neutral.'),
    ],
    validations: [
      {
        field: 'towMiles',
        rule: 'positiveNumber',
        message: 'Enter the distance in miles.',
      },
    ],
    transitions: [
      transition({ field: 'towMiles', gt: 100 }, 'R', {
        reasonCode: HANDOFF_CODES.OVER_LIMIT,
      }),
      transition(
        {
          all: [
            { field: 'towMiles', betweenExclusiveMin: [0, 100] },
            { field: 'neutral', in: ['yes', 'no', 'not_sure'] },
          ],
        },
        'S7',
        { allowEditReturn: true },
      ),
    ],
  },
  G1: {
    id: 'G1',
    title: 'Out of gas',
    step: 7,
    required: [
      required('fuelType', 'Choose the vehicle fuel type.'),
      required('gallons', 'Choose how many gallons you need.', {
        field: 'fuelType',
        eq: 'regular',
      }),
    ],
    transitions: [
      transition({ field: 'fuelType', in: ['diesel', 'not_sure'] }, 'R', {
        reasonCode: HANDOFF_CODES.UNLISTED_SERVICE,
      }),
      transition(
        {
          all: [
            { field: 'fuelType', eq: 'regular' },
            { field: 'gallons', gt: 0 },
          ],
        },
        'S7',
        { allowEditReturn: true },
      ),
    ],
  },
  M1: {
    id: 'M1',
    title: 'Mechanic check',
    step: 7,
    required: [
      required('mechanicIssue', "Choose what's going on with the vehicle."),
    ],
    transitions: [
      transition({ field: 'mechanicIssue', present: true }, 'S7', {
        allowEditReturn: true,
      }),
    ],
  },
  X1: {
    id: 'X1',
    title: 'Winch-out',
    step: 7,
    required: [
      required('orientation', 'Tell us whether the vehicle is on its wheels.'),
      required('distanceFeet', 'Enter an estimate in feet.', {
        field: 'orientation',
        eq: 'wheels',
      }),
    ],
    validations: [
      {
        field: 'distanceFeet',
        rule: 'nonNegativeNumber',
        message: 'Enter an estimate in feet.',
        when: { field: 'orientation', eq: 'wheels' },
      },
    ],
    transitions: [
      transition({ field: 'orientation', in: ['side', 'upside_down'] }, 'R', {
        reasonCode: HANDOFF_CODES.WINCH_SPECIALIST,
      }),
      transition(
        {
          all: [
            { field: 'orientation', eq: 'wheels' },
            { field: 'distanceFeet', gte: 0 },
          ],
        },
        'S7',
        { allowEditReturn: true },
      ),
    ],
  },
  S7: {
    id: 'S7',
    title: 'Quote summary',
    step: 8,
    required: [required('quoteAction', 'Choose how you want to continue.')],
    transitions: [
      transition({ field: 'quoteAction', eq: 'accept' }, 'S8A'),
      transition({ field: 'quoteAction', eq: 'pay_by_phone' }, 'R', {
        reasonCode: HANDOFF_CODES.PAY_BY_PHONE,
      }),
      transition({ field: 'quoteAction', eq: 'decline' }, null, {
        type: 'complete',
        outcome: 'declined',
      }),
      transition(
        {
          all: [
            { field: 'quoteAction', eq: 'edit' },
            { field: 'editScreenId', in: QUOTE_EDIT_SCREEN_IDS },
          ],
        },
        null,
        { toField: 'editScreenId', returnTo: 'S7' },
      ),
    ],
  },
  S8A: {
    id: 'S8A',
    title: 'Payment',
    step: 9,
    required: [
      required('paymentStatus', 'Complete payment or choose pay by phone.'),
    ],
    transitions: [
      transition({ field: 'paymentStatus', eq: 'succeeded' }, null, {
        type: 'complete',
        outcome: 'paid',
      }),
      transition({ field: 'paymentStatus', eq: 'failed' }, 'S8A', {
        type: 'stay',
        code: 'PAYMENT_FAILED',
      }),
      transition({ field: 'paymentStatus', eq: 'pay_by_phone' }, 'R', {
        reasonCode: HANDOFF_CODES.PAY_BY_PHONE,
      }),
    ],
  },
  R: {
    id: 'R',
    title: 'Hand-off to a person',
    step: null,
    required: [],
    transitions: [
      transition(
        { field: 'handoffAction', in: ['call_now', 'request_callback'] },
        null,
        {
          type: 'complete',
          outcomeField: 'handoffAction',
        },
      ),
    ],
  },
});

export const bookingFlow = Object.freeze({
  startScreenId: 'S0',
  totalSteps: 9,
  screens: screenConfigs,
  handoffCodes: HANDOFF_CODES,
});

export default bookingFlow;
