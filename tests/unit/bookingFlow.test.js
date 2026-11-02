import { describe, expect, it } from 'vitest';
import {
  HANDOFF_CODES,
  SCREEN_IDS,
  screenConfigs,
} from '@/features/booking/config/bookingFlow';
import {
  getNextTransition,
  getScreenConfig,
  getStepProgress,
  getVisibleFlow,
  isQuoteEditScreen,
} from '@/features/booking/utils/bookingFlow';

const validContact = {
  fullName: 'Maria Santos',
  mobileNumber: '(555) 555-0100',
  textConsent: true,
  codeStatus: 'verified',
};
const validVehicle = {
  year: 2019,
  make: 'Honda',
  model: 'CR-V',
  vehicleSize: 'regular',
};

const expectScreen = (transition, screenId) => {
  expect(transition).toMatchObject({
    type: 'screen',
    screenId,
    to: screenId,
    isValid: true,
  });
};

const expectHandoff = (transition, reasonCode) => {
  expect(transition).toMatchObject({
    type: 'handoff',
    screenId: 'R',
    reasonCode,
    isValid: true,
  });
};

describe('booking flow configuration', () => {
  it('preserves exactly the specified screen IDs', () => {
    expect(SCREEN_IDS).toEqual([
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
    expect(Object.keys(screenConfigs)).toEqual(SCREEN_IDS);
  });

  it('exposes configs without browser pricing calculations', () => {
    expect(getScreenConfig('S7')).toBe(screenConfigs.S7);
    expect(getScreenConfig('missing')).toBeNull();
    expect(JSON.stringify(screenConfigs)).not.toMatch(
      /total\s*=|priceCalculation/i,
    );
  });
});

describe('entry, contact, location, and vehicle transitions', () => {
  it('handles both S0 safety branches', () => {
    expectScreen(getNextTransition('S0', { isSafe: true }), 'S1');
    expect(getNextTransition('S0', { isSafe: false })).toMatchObject({
      type: 'screen',
      screenId: 'S1',
      noticeCode: 'CALL_911',
    });
  });

  it.each(['new', 'existing', 'cancel'])(
    'sends S1 %s requests to S2',
    (requestType) => {
      expectScreen(getNextTransition('S1', { requestType }), 'S2');
    },
  );

  it('routes verified S2 contacts by request type', () => {
    expectScreen(
      getNextTransition('S2', { ...validContact, requestType: 'new' }),
      'S4',
    );
    expectScreen(
      getNextTransition('S2', { ...validContact, requestType: 'existing' }),
      'S5',
    );
    expectScreen(
      getNextTransition('S2', { ...validContact, requestType: 'cancel' }),
      'S5',
    );
  });

  it('hands off after three failed verification attempts', () => {
    expectHandoff(
      getNextTransition('S2', { codeStatus: 'failed', codeAttempts: 3 }),
      HANDOFF_CODES.MISSING_INFO,
    );
  });

  it('handles every S4 result', () => {
    expectScreen(
      getNextTransition('S4', { locationStatus: 'confirmed' }),
      'S5',
    );
    expectHandoff(
      getNextTransition('S4', { locationStatus: 'unavailable' }),
      HANDOFF_CODES.MISSING_INFO,
    );
    expect(
      getNextTransition('S4', { locationStatus: 'not_found' }),
    ).toMatchObject({
      type: 'validation',
      screenId: 'S4',
      code: 'ADDRESS_NOT_FOUND',
    });
    expect(
      getNextTransition('S4', { locationStatus: 'pin_moved' }),
    ).toMatchObject({
      type: 'validation',
      code: 'PIN_CONFIRMATION_REQUIRED',
    });
  });

  it('handles every S5 request and size branch', () => {
    expectScreen(
      getNextTransition('S5', { ...validVehicle, requestType: 'new' }),
      'S6',
    );
    expectHandoff(
      getNextTransition('S5', { ...validVehicle, requestType: 'existing' }),
      HANDOFF_CODES.EXISTING_JOB,
    );
    expectHandoff(
      getNextTransition('S5', { ...validVehicle, requestType: 'cancel' }),
      HANDOFF_CODES.CANCEL_JOB,
    );
    expectHandoff(
      getNextTransition('S5', { vehicleSize: 'heavy' }),
      HANDOFF_CODES.HEAVY_DUTY,
    );
    expectHandoff(
      getNextTransition('S5', { vehicleSize: 'unknown' }),
      HANDOFF_CODES.MISSING_INFO,
    );
  });
});

describe('service transitions', () => {
  it.each([
    ['jump_start', 'J1'],
    ['flat_tire', 'T1'],
    ['locked_out', 'L1'],
    ['tow', 'W1'],
    ['out_of_gas', 'G1'],
    ['mechanic_check', 'M1'],
    ['stuck', 'X1'],
  ])('routes S6 %s to %s', (serviceType, screenId) => {
    expectScreen(getNextTransition('S6', { serviceType }), screenId);
  });

  it('hands an unlisted S6 service to a specialist', () => {
    expectHandoff(
      getNextTransition('S6', { serviceType: 'other' }),
      HANDOFF_CODES.UNLISTED_SERVICE,
    );
  });

  it('handles J1 battery limits', () => {
    for (const batteryCount of [1, 2, 3, 4]) {
      expectScreen(getNextTransition('J1', { batteryCount }), 'S7');
    }
    expectHandoff(
      getNextTransition('J1', { batteryCount: 5 }),
      HANDOFF_CODES.OVER_LIMIT,
    );
  });

  it('handles every T1 tire branch', () => {
    expect(
      getNextTransition('T1', { tireHandling: 'spare', damagedTires: 1 }),
    ).toMatchObject({
      type: 'screen',
      screenId: 'S7',
      serviceType: 'tire_change',
    });
    expect(
      getNextTransition('T1', {
        tireHandling: 'replacement',
        damagedTires: 1,
        tireSize: '225/65R17',
      }),
    ).toMatchObject({
      type: 'screen',
      screenId: 'S7',
      serviceType: 'tire_replace',
    });
    expectHandoff(
      getNextTransition('T1', { tireHandling: 'spare', damagedTires: 2 }),
      HANDOFF_CODES.OVER_LIMIT,
    );
    expect(getNextTransition('T1', { tireHandling: 'tow' })).toMatchObject({
      type: 'screen',
      screenId: 'W1',
      serviceType: 'tow',
    });
  });

  it('handles both L1 safety answers and flags urgent jobs', () => {
    expectScreen(getNextTransition('L1', { childOrPetInside: false }), 'S7');
    expect(getNextTransition('L1', { childOrPetInside: true })).toMatchObject({
      type: 'screen',
      screenId: 'S7',
      noticeCode: 'CALL_911',
      jobFlags: ['urgent'],
    });
  });

  it('validates W1 and models pickup-pin return behavior', () => {
    expectScreen(
      getNextTransition('W1', { dropoffAddress: '100 Main St, Miami, FL' }),
      'W2',
    );
    expect(getNextTransition('W1', { pickupChanged: true })).toMatchObject({
      type: 'screen',
      screenId: 'S4',
      returnTo: 'W1',
    });
  });

  it.each(['yes', 'no', 'not_sure'])(
    'accepts W2 neutral=%s within the limit',
    (neutral) => {
      expectScreen(getNextTransition('W2', { towMiles: 12.5, neutral }), 'S7');
    },
  );

  it('validates bad W2 mileage and hands off over-limit towing', () => {
    expect(
      getNextTransition('W2', { towMiles: 0, neutral: 'yes' }),
    ).toMatchObject({
      type: 'validation',
      screenId: 'W2',
      errors: [{ field: 'towMiles', message: 'Enter the distance in miles.' }],
    });
    expectHandoff(
      getNextTransition('W2', { towMiles: 100.1, neutral: 'yes' }),
      HANDOFF_CODES.OVER_LIMIT,
    );
  });

  it('handles every G1 fuel branch', () => {
    expectScreen(
      getNextTransition('G1', { fuelType: 'regular', gallons: 2 }),
      'S7',
    );
    for (const fuelType of ['diesel', 'not_sure']) {
      expectHandoff(
        getNextTransition('G1', { fuelType }),
        HANDOFF_CODES.UNLISTED_SERVICE,
      );
    }
  });

  it('accepts any M1 issue while leaving notes optional', () => {
    expectScreen(
      getNextTransition('M1', { mechanicIssue: 'warning_light' }),
      'S7',
    );
  });

  it('handles every X1 orientation branch', () => {
    expectScreen(
      getNextTransition('X1', { orientation: 'wheels', distanceFeet: 0 }),
      'S7',
    );
    for (const orientation of ['side', 'upside_down']) {
      expectHandoff(
        getNextTransition('X1', { orientation }),
        HANDOFF_CODES.WINCH_SPECIALIST,
      );
    }
  });
});

describe('quote, payment, handoff, and editing', () => {
  it('handles every S7 action', () => {
    expectScreen(getNextTransition('S7', { quoteAction: 'accept' }), 'S8A');
    expectHandoff(
      getNextTransition('S7', { quoteAction: 'pay_by_phone' }),
      HANDOFF_CODES.PAY_BY_PHONE,
    );
    expect(getNextTransition('S7', { quoteAction: 'decline' })).toMatchObject({
      type: 'complete',
      outcome: 'declined',
      screenId: null,
    });
    expect(
      getNextTransition('S7', { quoteAction: 'edit', editScreenId: 'W2' }),
    ).toMatchObject({
      type: 'screen',
      screenId: 'W2',
      returnTo: 'S7',
    });
  });

  it('returns to S7 after a modeled detail edit', () => {
    expectScreen(
      getNextTransition('W2', {
        towMiles: 20,
        neutral: 'no',
        editReturnTo: 'S7',
      }),
      'S7',
    );
    expectScreen(
      getNextTransition('S4', {
        locationStatus: 'confirmed',
        editReturnTo: 'W1',
      }),
      'W1',
    );
    expect(isQuoteEditScreen('W2')).toBe(true);
    expect(isQuoteEditScreen('S8A')).toBe(false);
  });

  it('handles every S8A payment result', () => {
    expect(
      getNextTransition('S8A', { paymentStatus: 'succeeded' }),
    ).toMatchObject({
      type: 'complete',
      outcome: 'paid',
    });
    expect(getNextTransition('S8A', { paymentStatus: 'failed' })).toMatchObject(
      {
        type: 'stay',
        screenId: 'S8A',
        code: 'PAYMENT_FAILED',
      },
    );
    expectHandoff(
      getNextTransition('S8A', { paymentStatus: 'pay_by_phone' }),
      HANDOFF_CODES.PAY_BY_PHONE,
    );
  });

  it('models both terminal R actions', () => {
    for (const handoffAction of ['call_now', 'request_callback']) {
      expect(getNextTransition('R', { handoffAction })).toMatchObject({
        type: 'complete',
        outcome: handoffAction,
      });
    }
  });

  it('supports USER_REQUEST from every screen', () => {
    for (const screenId of SCREEN_IDS) {
      expectHandoff(
        getNextTransition(screenId, { talkToPerson: true }),
        HANDOFF_CODES.USER_REQUEST,
      );
    }
  });

  it('covers every preserved handoff reason code', () => {
    const raisedCodes = new Set([
      getNextTransition('S0', { talkToPerson: true }).reasonCode,
      getNextTransition('S5', { ...validVehicle, requestType: 'existing' })
        .reasonCode,
      getNextTransition('S5', { ...validVehicle, requestType: 'cancel' })
        .reasonCode,
      getNextTransition('S4', { locationStatus: 'unavailable' }).reasonCode,
      getNextTransition('S5', { vehicleSize: 'heavy' }).reasonCode,
      getNextTransition('S6', { serviceType: 'other' }).reasonCode,
      getNextTransition('X1', { orientation: 'side' }).reasonCode,
      getNextTransition('J1', { batteryCount: 5 }).reasonCode,
      getNextTransition('S7', { quoteAction: 'pay_by_phone' }).reasonCode,
    ]);
    expect(raisedCodes).toEqual(new Set(Object.values(HANDOFF_CODES)));
  });
});

describe('validation and visible progress', () => {
  it.each(SCREEN_IDS)('signals missing mandatory answers on %s', (screenId) => {
    const transition = getNextTransition(screenId, {});
    expect(transition).toMatchObject({
      type: 'validation',
      screenId,
      isValid: false,
    });
    expect(transition.errors.length).toBeGreaterThan(0);
  });

  it('reports field-level contact validation errors', () => {
    const transition = getNextTransition('S2', {
      fullName: 'Maria',
      mobileNumber: '123',
      textConsent: false,
      codeStatus: 'verified',
      requestType: 'new',
    });
    expect(transition.errors.map(({ field }) => field)).toEqual([
      'fullName',
      'mobileNumber',
      'textConsent',
    ]);
  });

  it('enforces conditional tire, gas, and winch answers', () => {
    expect(
      getNextTransition('T1', { tireHandling: 'replacement', damagedTires: 1 })
        .errors,
    ).toContainEqual(expect.objectContaining({ field: 'tireSize' }));
    expect(
      getNextTransition('G1', { fuelType: 'regular' }).errors,
    ).toContainEqual(expect.objectContaining({ field: 'gallons' }));
    expect(
      getNextTransition('X1', { orientation: 'wheels' }).errors,
    ).toContainEqual(expect.objectContaining({ field: 'distanceFeet' }));
  });

  it('builds the visible new-request paths', () => {
    expect(
      getVisibleFlow({ requestType: 'new', serviceType: 'jump_start' }),
    ).toEqual(['S0', 'S1', 'S2', 'S4', 'S5', 'S6', 'J1', 'S7', 'S8A']);
    expect(
      getVisibleFlow({
        requestType: 'new',
        serviceType: 'flat_tire',
        tireHandling: 'tow',
      }),
    ).toEqual([
      'S0',
      'S1',
      'S2',
      'S4',
      'S5',
      'S6',
      'T1',
      'W1',
      'W2',
      'S7',
      'S8A',
    ]);
  });

  it('builds existing/cancel and handoff-visible paths', () => {
    expect(getVisibleFlow({ requestType: 'existing' })).toEqual([
      'S0',
      'S1',
      'S2',
      'S5',
      'R',
    ]);
    expect(
      getVisibleFlow({
        requestType: 'new',
        serviceType: 'jump_start',
        handoffReason: HANDOFF_CODES.OVER_LIMIT,
        handoffFrom: 'J1',
      }),
    ).toEqual(['S0', 'S1', 'S2', 'S4', 'S5', 'S6', 'J1', 'R']);
  });

  it('reports document progress and tow substeps', () => {
    expect(
      getStepProgress('W2', { requestType: 'new', serviceType: 'tow' }),
    ).toEqual({
      currentStep: 7,
      totalSteps: 9,
      substep: { current: 2, total: 2 },
      visibleIndex: 8,
      visibleCount: 10,
    });
    expect(
      getStepProgress('S8A', { requestType: 'new', serviceType: 'jump_start' }),
    ).toMatchObject({
      currentStep: 9,
      totalSteps: 9,
      visibleIndex: 9,
      visibleCount: 9,
    });
  });

  it('rejects unknown screen IDs', () => {
    expect(() => getNextTransition('S3', {})).toThrow(
      'Unknown booking screen: S3',
    );
    expect(() => getStepProgress('S3', {})).toThrow(
      'Unknown booking screen: S3',
    );
  });
});
