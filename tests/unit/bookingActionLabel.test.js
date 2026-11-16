import { describe, expect, it } from 'vitest';
import { getBookingActionLabel } from '@/features/booking/utils/bookingActionLabel';

describe('booking primary action label', () => {
  it('describes over-limit tow handoff instead of promising a quote', () => {
    expect(
      getBookingActionLabel('W2', {
        routeCalculationId: '6debfdb7-0de4-4fc5-93b4-c0818dc81d69',
        routeStatus: 'ready',
        routeBillableMiles: 197,
      }),
    ).toBe('Continue to dispatcher');
  });

  it('offers a quote for an eligible completed tow route', () => {
    expect(
      getBookingActionLabel('W2', {
        routeCalculationId: '6debfdb7-0de4-4fc5-93b4-c0818dc81d69',
        routeStatus: 'ready',
        routeBillableMiles: 13,
        neutral: 'yes',
      }),
    ).toBe('See my quote');
  });

  it('uses a neutral label while required service answers are incomplete', () => {
    expect(getBookingActionLabel('W2', {})).toBe('Continue');
  });
});
