import { describe, expect, it } from 'vitest';
import {
  InvalidBookingTransitionError,
  prepareBookingDraft,
} from '@/features/booking/schemas/bookingSessionSchema';

const validContactDraft = {
  currentScreenId: 'S2',
  answers: {
    isSafe: true,
    requestType: 'new',
    fullName: 'Maria Santos',
    receiptEmail: 'maria@example.com',
    mobileNumber: '(555) 555-0100',
    contactAttached: true,
    paymentStatus: 'succeeded',
  },
  history: ['S0', 'S1'],
  version: 3,
};

const attachedCustomer = {
  id: '00000000-0000-4000-8000-000000000010',
  fullName: 'Maria Santos',
  receiptEmail: 'maria@example.com',
  phoneE164: '+15555550100',
  phoneVerifiedAt: null,
};

describe('booking session server validation', () => {
  it('normalizes an authorized draft without trusting contact or payment state', () => {
    const draft = prepareBookingDraft(validContactDraft);

    expect(draft.currentScreenId).toBe('S2');
    expect(draft.flowRequestType).toBe('new');
    expect(draft.progressPercent).toBe(25);
    expect(draft.version).toBe(3);
    expect(draft.answers.fullName).toBe('Maria Santos');
    expect(draft.answers).not.toHaveProperty('contactAttached');
    expect(draft.answers).not.toHaveProperty('paymentStatus');
  });

  it('requires a matching server-attached customer before advancing beyond S2', () => {
    const advanced = {
      ...validContactDraft,
      currentScreenId: 'S4',
      history: ['S0', 'S1', 'S2'],
    };

    expect(() => prepareBookingDraft(advanced)).toThrow(
      InvalidBookingTransitionError,
    );
    expect(
      prepareBookingDraft(advanced, attachedCustomer).currentScreenId,
    ).toBe('S4');
  });

  it('accepts only a matching server-resolved location snapshot', () => {
    const resolutionId = '3ed90ff8-57b2-49ac-bfb1-675f6d3f95f0';
    const input = {
      ...validContactDraft,
      currentScreenId: 'S5',
      history: ['S0', 'S1', 'S2', 'S4'],
      answers: {
        ...validContactDraft.answers,
        locationResolutionId: resolutionId,
        locationAddress: 'Forged address',
        locationTimezone: 'Etc/UTC',
        locationStatus: 'confirmed',
      },
    };
    const trustedLocation = {
      resolutionId,
      formattedAddress: '1200 N Federal Hwy, Hollywood, FL 33020, USA',
      placeId: 'trusted-place',
      latitude: 26.021,
      longitude: -80.142,
      timezone: 'America/New_York',
      countryCode: 'US',
      serviceAreaStatus: 'available',
      source: 'places',
      accuracyMeters: null,
      resolvedAt: '2026-11-02T10:00:00.000Z',
    };

    const draft = prepareBookingDraft(input, attachedCustomer, trustedLocation);
    expect(draft.answers.locationAddress).toBe(
      trustedLocation.formattedAddress,
    );
    expect(draft.answers.locationTimezone).toBe('America/New_York');
    expect(draft.currentScreenId).toBe('S5');

    expect(() => prepareBookingDraft(input, attachedCustomer)).toThrow(
      InvalidBookingTransitionError,
    );
  });

  it('replaces browser route values with a matching server snapshot', () => {
    const pickup = {
      resolutionId: '3ed90ff8-57b2-49ac-bfb1-675f6d3f95f0',
      formattedAddress: '1200 N Federal Hwy, Hollywood, FL 33020, USA',
      placeId: 'pickup-place',
      latitude: 26.021,
      longitude: -80.142,
      timezone: 'America/New_York',
      countryCode: 'US',
      serviceAreaStatus: 'available',
      source: 'places',
      accuracyMeters: null,
      resolvedAt: '2026-11-02T10:00:00.000Z',
    };
    const dropoff = {
      ...pickup,
      resolutionId: 'b08d5dd2-a13b-4097-b5f7-eed513af00e1',
      formattedAddress: '1000 Biscayne Blvd, Miami, FL 33132, USA',
      placeId: 'dropoff-place',
      latitude: 25.785,
      longitude: -80.19,
    };
    const route = {
      routeCalculationId: '6debfdb7-0de4-4fc5-93b4-c0818dc81d69',
      pickupResolutionId: pickup.resolutionId,
      dropoffResolutionId: dropoff.resolutionId,
      distanceMeters: 20117,
      rawMiles: 12.5,
      billableMiles: 13,
      durationSeconds: 1500,
      encodedPolyline: 'trusted-route',
      rateBand: 'short',
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      calculatedAt: '2026-11-02T10:00:00.000Z',
      expiresAt: '2099-11-02T10:15:00.000Z',
    };
    const input = {
      ...validContactDraft,
      currentScreenId: 'W2',
      history: ['S0', 'S1', 'S2', 'S4', 'S5', 'S6', 'W1'],
      answers: {
        ...validContactDraft.answers,
        locationResolutionId: pickup.resolutionId,
        locationStatus: 'confirmed',
        year: '2019',
        make: 'Honda',
        model: 'CR-V',
        vehicleSize: 'regular',
        serviceType: 'tow',
        dropoffResolutionId: dropoff.resolutionId,
        dropoffStatus: 'confirmed',
        routeCalculationId: route.routeCalculationId,
        routeBillableMiles: 1,
        routeEncodedPolyline: 'forged-route'.repeat(1000),
        routeStatus: 'ready',
      },
    };

    const draft = prepareBookingDraft(
      input,
      attachedCustomer,
      pickup,
      dropoff,
      route,
    );
    expect(draft.answers.routeBillableMiles).toBe(13);
    expect(draft.answers.routeEncodedPolyline).toBe('trusted-route');
    expect(draft.answers.routeStatus).toBe('ready');

    const withoutTrustedRoute = prepareBookingDraft(
      input,
      attachedCustomer,
      pickup,
      dropoff,
    );
    expect(withoutTrustedRoute.answers).not.toHaveProperty(
      'routeBillableMiles',
    );
    expect(withoutTrustedRoute.answers).not.toHaveProperty('routeStatus');
  });

  it('rejects attempts to skip mandatory upstream screens', () => {
    expect(() =>
      prepareBookingDraft({
        currentScreenId: 'S7',
        answers: { isSafe: true, requestType: 'new' },
        history: ['S0', 'S1'],
        version: 0,
      }),
    ).toThrow(InvalidBookingTransitionError);
  });

  it('formats user-friendly error messages on invalid booking transitions', () => {
    try {
      prepareBookingDraft({
        currentScreenId: 'S7',
        answers: { isSafe: true, requestType: 'new' },
        history: ['S0', 'S1'],
        version: 0,
      });
      expect.fail('Expected InvalidBookingTransitionError');
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidBookingTransitionError);
      expect(error.message).not.toContain('Screen S7 is not reachable');
      expect(error.message).not.toContain('contactAttached:');
      expect(error.message).toContain('Save your contact details before continuing');
    }
  });

  it('rejects unknown answer structures and screen identifiers', () => {
    expect(() =>
      prepareBookingDraft({
        ...validContactDraft,
        currentScreenId: 'S3',
      }),
    ).toThrow();
    expect(() =>
      prepareBookingDraft({
        ...validContactDraft,
        answers: { requestType: { privileged: true } },
      }),
    ).toThrow();
  });
});
