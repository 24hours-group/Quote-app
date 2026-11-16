import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { quoteRequestSchema } from '@/features/pricing/services/quoteService';

describe('authoritative quote request validation', () => {
  it('discards browser-derived route data before validating the quote request', () => {
    const routeCalculationId = '6debfdb7-0de4-4fc5-93b4-c0818dc81d69';
    const parsed = quoteRequestSchema.parse({
      answers: {
        serviceType: 'tow',
        routeCalculationId,
        routeEncodedPolyline: 'encoded-route'.repeat(1000),
        routeRawMiles: 1,
        routeBillableMiles: 1,
        routeStatus: 'ready',
      },
    });

    expect(parsed.answers.routeCalculationId).toBe(routeCalculationId);
    expect(parsed.answers.routeStatus).toBe('ready');
    expect(parsed.answers).not.toHaveProperty('routeEncodedPolyline');
    expect(parsed.answers).not.toHaveProperty('routeRawMiles');
    expect(parsed.answers).not.toHaveProperty('routeBillableMiles');
  });
});
