import { describe, expect, it } from 'vitest';
import {
  normalizeWizardState,
  sanitizePersistedAnswers,
  updateBookingAnswer,
} from '@/features/booking/utils/bookingState';
import { assertDemoBookingAvailable } from '@/features/booking/services/mockBookingService';

const validAnswers = {
  isSafe: true,
  requestType: 'new',
  fullName: 'Maria Santos',
  receiptEmail: 'maria@example.com',
  mobileNumber: '(555) 555-0100',
  contactAttached: true,
  locationResolutionId: '3ed90ff8-57b2-49ac-bfb1-675f6d3f95f0',
  locationAddress: '1200 N Federal Hwy, Hollywood, FL',
  locationStatus: 'confirmed',
  year: '2019',
  make: 'Honda',
  model: 'CR-V',
  vehicleSize: 'regular',
  serviceType: 'jump_start',
  batteryCount: 1,
};

describe('booking answer invalidation', () => {
  it('clears incompatible service and terminal answers after service changes', () => {
    const answers = updateBookingAnswer(
      {
        ...validAnswers,
        serviceType: 'tow',
        resolvedServiceType: 'tow',
        dropoffResolutionId: 'b08d5dd2-a13b-4097-b5f7-eed513af00e1',
        dropoffAddress: '100 Main St, Miami, FL',
        dropoffStatus: 'confirmed',
        routeCalculationId: '6debfdb7-0de4-4fc5-93b4-c0818dc81d69',
        routeBillableMiles: 12,
        routeStatus: 'ready',
        neutral: 'yes',
        quoteId: '00000000-0000-4000-8000-000000000201',
        quoteStatus: 'accepted',
        quotePricingVersion: 2,
        quoteValidUntil: '2026-11-03T12:30:00.000Z',
        quoteTotalCents: 27300,
        quoteAction: 'accept',
        paymentStatus: 'succeeded',
      },
      'serviceType',
      'jump_start',
    );

    expect(answers.serviceType).toBe('jump_start');
    expect(answers).not.toHaveProperty('resolvedServiceType');
    expect(answers).not.toHaveProperty('dropoffAddress');
    expect(answers).not.toHaveProperty('routeBillableMiles');
    expect(answers).not.toHaveProperty('neutral');
    expect(answers).not.toHaveProperty('quoteId');
    expect(answers).not.toHaveProperty('quoteStatus');
    expect(answers).not.toHaveProperty('quoteAction');
    expect(answers).not.toHaveProperty('paymentStatus');
  });

  it('clears the skipped new-request path when request type changes', () => {
    const answers = updateBookingAnswer(
      {
        ...validAnswers,
        quoteAction: 'accept',
        handoffReason: 'OVER_LIMIT',
        bookingReference: 'RS-1A2B3C4D5E',
      },
      'requestType',
      'existing',
    );

    expect(answers.requestType).toBe('existing');
    expect(answers.locationAddress).toBeUndefined();
    expect(answers.year).toBeUndefined();
    expect(answers.serviceType).toBeUndefined();
    expect(answers.quoteAction).toBeUndefined();
    expect(answers.handoffReason).toBeUndefined();
    expect(answers.bookingReference).toBeUndefined();
  });

  it('clears tire and tow answers when tire handling changes', () => {
    const answers = updateBookingAnswer(
      {
        tireHandling: 'tow',
        damagedTires: 1,
        tireSize: '225/65R17',
        resolvedServiceType: 'tow',
        dropoffResolutionId: 'b08d5dd2-a13b-4097-b5f7-eed513af00e1',
        dropoffAddress: '100 Main St, Miami, FL',
        dropoffStatus: 'confirmed',
        routeCalculationId: '6debfdb7-0de4-4fc5-93b4-c0818dc81d69',
        routeBillableMiles: 10,
        routeStatus: 'ready',
        neutral: 'yes',
      },
      'tireHandling',
      'spare',
    );

    expect(answers).toEqual({ tireHandling: 'spare' });
  });

  it('invalidates confirmation, route, and quote state when the pin changes', () => {
    const answers = updateBookingAnswer(
      {
        ...validAnswers,
        locationLongitude: -80.14,
        routeCalculationId: '6debfdb7-0de4-4fc5-93b4-c0818dc81d69',
        routeBillableMiles: 12,
        routeStatus: 'ready',
        quoteAction: 'accept',
      },
      'locationLongitude',
      -80.15,
    );

    expect(answers.locationLongitude).toBe(-80.15);
    expect(answers).not.toHaveProperty('locationStatus');
    expect(answers).not.toHaveProperty('routeBillableMiles');
    expect(answers).not.toHaveProperty('quoteAction');
  });

  it('clears all resolved location data when the resolution changes', () => {
    const answers = updateBookingAnswer(
      {
        ...validAnswers,
        locationPlaceId: 'old-place',
        locationLatitude: 26.02,
        locationLongitude: -80.14,
        locationTimezone: 'America/New_York',
      },
      'locationResolutionId',
      'c4b30de1-d14b-42cf-bc21-b861e8a31ae4',
    );

    expect(answers.locationResolutionId).toBe(
      'c4b30de1-d14b-42cf-bc21-b861e8a31ae4',
    );
    expect(answers).not.toHaveProperty('locationAddress');
    expect(answers).not.toHaveProperty('locationPlaceId');
    expect(answers).not.toHaveProperty('locationLatitude');
    expect(answers).not.toHaveProperty('locationStatus');
  });

  it('preserves unrelated answers and edit-return state', () => {
    const answers = updateBookingAnswer(
      {
        ...validAnswers,
        editReturnTo: 'S7',
        routeBillableMiles: 10,
        routeStatus: 'ready',
      },
      'routeBillableMiles',
      15,
    );

    expect(answers.fullName).toBe('Maria Santos');
    expect(answers.editReturnTo).toBe('S7');
    expect(answers.routeBillableMiles).toBe(15);
    expect(answers).not.toHaveProperty('routeStatus');
  });
});

describe('booking draft normalization', () => {
  it('falls back to the nearest reachable screen and removes unknown data', () => {
    const normalized = normalizeWizardState({
      currentScreenId: 'S8A',
      answers: {
        isSafe: true,
        requestType: 'new',
        fullName: 'Maria Santos',
        privilegedOverride: true,
      },
      history: ['S0', 'S1', 'not-a-screen', 'S7'],
    });

    expect(normalized.currentScreenId).toBe('S2');
    expect(normalized.answers).not.toHaveProperty('privilegedOverride');
    expect(normalized.history).toEqual(['S0', 'S1']);
  });

  it('restores a reachable quote screen and valid history', () => {
    const normalized = normalizeWizardState(
      {
        currentScreenId: 'S7',
        answers: validAnswers,
        history: ['S0', 'S1', 'S2', 'S4', 'S5', 'S6', 'J1'],
      },
      { codeStatus: 'verified', codeAttempts: 0 },
    );

    expect(normalized.currentScreenId).toBe('S7');
    expect(normalized.history.at(-1)).toBe('J1');
  });

  it('allowlists server draft fields and excludes OTP and payment data', () => {
    const answers = sanitizePersistedAnswers({
      ...validAnswers,
      verificationCode: '123456',
      quoteId: '00000000-0000-4000-8000-000000000201',
      quoteStatus: 'accepted',
      quotePricingVersion: 2,
      quoteValidUntil: '2026-11-03T12:30:00.000Z',
      quoteTotalCents: 15000,
      paymentStatus: 'succeeded',
      stripeClientSecret: 'secret',
      privilegedOverride: true,
    });

    expect(answers.fullName).toBe('Maria Santos');
    expect(answers).toMatchObject({
      quoteId: '00000000-0000-4000-8000-000000000201',
      quoteStatus: 'accepted',
      quotePricingVersion: 2,
      quoteTotalCents: 15000,
    });
    expect(answers).not.toHaveProperty('verificationCode');
    expect(answers).not.toHaveProperty('codeStatus');
    expect(answers).not.toHaveProperty('codeAttempts');
    expect(answers).not.toHaveProperty('paymentStatus');
    expect(answers).not.toHaveProperty('stripeClientSecret');
    expect(answers).not.toHaveProperty('privilegedOverride');
  });
});

describe('demo booking guard', () => {
  it('fails closed in production and remains available locally', () => {
    expect(() => assertDemoBookingAvailable('production')).toThrow(
      /disabled in production/i,
    );
    expect(() => assertDemoBookingAvailable('development')).not.toThrow();
    expect(() => assertDemoBookingAvailable('test')).not.toThrow();
  });
});
