import { describe, expect, it } from 'vitest';
import { formatRouteDuration } from '@/features/booking/utils/routeDisplay';

describe('route duration display', () => {
  it.each([
    [30, '1 min'],
    [1800, '30 min'],
    [3600, '1 hr'],
    [4500, '1 hr 15 min'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatRouteDuration(seconds)).toBe(expected);
  });
});
