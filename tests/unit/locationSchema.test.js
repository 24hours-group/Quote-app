import { describe, expect, it } from 'vitest';
import {
  locationResolveRequestSchema,
  resolvedLocationSchema,
  toBookingLocationAnswers,
} from '@/features/booking/schemas/locationSchema';

describe('location schemas', () => {
  it('requires either a place ID or a complete coordinate pair', () => {
    expect(() =>
      locationResolveRequestSchema.parse({ source: 'geolocation' }),
    ).toThrow();
    expect(() =>
      locationResolveRequestSchema.parse({
        source: 'marker_drag',
        latitude: 26,
      }),
    ).toThrow();
    expect(
      locationResolveRequestSchema.parse({
        source: 'places',
        placeId: 'google-place-id',
      }).placeId,
    ).toBe('google-place-id');
  });

  it('rejects coordinates outside geographic bounds', () => {
    expect(() =>
      locationResolveRequestSchema.parse({
        source: 'geolocation',
        latitude: 91,
        longitude: -80,
      }),
    ).toThrow();
  });

  it('maps only validated server fields into booking answers', () => {
    const location = resolvedLocationSchema.parse({
      resolutionId: '3ed90ff8-57b2-49ac-bfb1-675f6d3f95f0',
      formattedAddress: '1200 N Federal Hwy, Hollywood, FL 33020, USA',
      placeId: 'place-id',
      latitude: 26.021,
      longitude: -80.142,
      timezone: 'America/New_York',
      countryCode: 'US',
      serviceAreaStatus: 'available',
      source: 'places',
      accuracyMeters: null,
      resolvedAt: '2026-11-02T10:00:00.000Z',
    });

    expect(toBookingLocationAnswers(location)).toMatchObject({
      locationAddress: location.formattedAddress,
      locationTimezone: 'America/New_York',
      locationServiceAreaStatus: 'available',
    });
  });
});
