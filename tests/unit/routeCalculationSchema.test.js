import { describe, expect, it } from 'vitest';
import {
  METERS_PER_MILE,
  TOW_MAX_MILES,
  isRouteSnapshotFresh,
  metersToMiles,
  routeCalculationRequestSchema,
  toRouteSnapshot,
} from '@/features/booking/schemas/routeCalculationSchema';

const identifiers = {
  routeCalculationId: '6debfdb7-0de4-4fc5-93b4-c0818dc81d69',
  pickupResolutionId: '3ed90ff8-57b2-49ac-bfb1-675f6d3f95f0',
  dropoffResolutionId: 'b08d5dd2-a13b-4097-b5f7-eed513af00e1',
};

function snapshotFor(distanceMeters, now = new Date('2026-11-02T10:00:00Z')) {
  return toRouteSnapshot(
    {
      distanceMeters,
      durationSeconds: 600,
      encodedPolyline: 'encoded-route',
    },
    identifiers,
    now,
  );
}

describe('route calculation schema', () => {
  it('converts meters using exactly 1609.344 meters per mile', () => {
    expect(METERS_PER_MILE).toBe(1609.344);
    expect(metersToMiles(1609.344)).toBe(1);
    expect(metersToMiles(8046.72)).toBe(5);
  });

  it('rounds billable miles upward without altering raw miles', () => {
    const route = snapshotFor(1610);
    expect(route.rawMiles).toBe(1610 / METERS_PER_MILE);
    expect(route.billableMiles).toBe(2);
  });

  it('preserves the 20-mile short/long threshold', () => {
    const thresholdMeters = Math.floor(METERS_PER_MILE * 20);
    expect(snapshotFor(thresholdMeters).rateBand).toBe('short');
    expect(snapshotFor(thresholdMeters + 1).rateBand).toBe('long');
  });

  it('preserves the 100-mile online maximum', () => {
    const maximumMeters = Math.floor(METERS_PER_MILE * TOW_MAX_MILES);
    expect(snapshotFor(maximumMeters).billableMiles).toBe(100);
    expect(snapshotFor(maximumMeters + 1).billableMiles).toBe(101);
  });

  it('detects expired route snapshots and rejects identical endpoints', () => {
    const route = snapshotFor(Math.floor(METERS_PER_MILE * 5));
    expect(
      isRouteSnapshotFresh(route, Date.parse('2026-11-02T10:14:59Z')),
    ).toBe(true);
    expect(
      isRouteSnapshotFresh(route, Date.parse('2026-11-02T10:15:01Z')),
    ).toBe(false);
    expect(() =>
      routeCalculationRequestSchema.parse({
        pickupResolutionId: identifiers.pickupResolutionId,
        dropoffResolutionId: identifiers.pickupResolutionId,
      }),
    ).toThrow(/different locations/i);
  });
});
