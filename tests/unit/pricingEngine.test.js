import { describe, expect, it } from 'vitest';
import { calculateQuote } from '@/features/pricing/services/pricingEngine';
import { PRICING_KEYS } from '@/features/pricing/services/pricingPolicy';
import { getQuoteRefreshDelay } from '@/features/pricing/hooks/useAuthoritativeQuote';

const values = {
  [PRICING_KEYS.DAY_START]: 420,
  [PRICING_KEYS.DAY_END]: 1140,
  [PRICING_KEYS.QUOTE_VALID_MIN]: 30,
  [PRICING_KEYS.ROUNDING]: 1,
  [PRICING_KEYS.JS_1_DAY]: 15000,
  [PRICING_KEYS.JS_1_NIGHT]: 20000,
  [PRICING_KEYS.JS_2]: 22900,
  [PRICING_KEYS.JS_3]: 26500,
  [PRICING_KEYS.JS_4]: 29500,
  [PRICING_KEYS.JS_MAX_BATTERIES]: 4,
  [PRICING_KEYS.TIRE_DAY]: 16500,
  [PRICING_KEYS.TIRE_NIGHT]: 20000,
  [PRICING_KEYS.LOCKOUT_DAY]: 15000,
  [PRICING_KEYS.LOCKOUT_NIGHT]: 20000,
  [PRICING_KEYS.MECH_DAY]: 15000,
  [PRICING_KEYS.MECH_NIGHT]: 30000,
  [PRICING_KEYS.TOW_HOOK_NEUTRAL_OK]: 16900,
  [PRICING_KEYS.TOW_HOOK_NEUTRAL_FAIL]: 18900,
  [PRICING_KEYS.TOW_RATE_SHORT]: 800,
  [PRICING_KEYS.TOW_RATE_LONG]: 1000,
  [PRICING_KEYS.TOW_THRESHOLD_MI]: 20,
  [PRICING_KEYS.TOW_MAX_MI]: 100,
  [PRICING_KEYS.GAS_BASE]: 19900,
  [PRICING_KEYS.GAS_PRICE_PER_GAL]: 400,
  [PRICING_KEYS.GAS_INCLUDED_MI]: 5,
  [PRICING_KEYS.GAS_RATE_PER_MI]: 500,
  [PRICING_KEYS.WINCH_BASE]: 28500,
  [PRICING_KEYS.WINCH_INCLUDED_FT]: 10,
  [PRICING_KEYS.WINCH_STEP_FT]: 10,
  [PRICING_KEYS.WINCH_STEP_PRICE]: 10000,
};
const parameters = Object.fromEntries(
  Object.entries(values).map(([key, value]) => [key, { value }]),
);

function quote(answers, pricedAt = '2026-07-01T16:00:00.000Z') {
  return calculateQuote({
    answers,
    parameters,
    pricingVersion: 2,
    timezone: 'America/New_York',
    pricedAt: new Date(pricedAt),
  });
}

describe('authoritative pricing engine', () => {
  it('uses 07:00 through 18:59 in the vehicle timezone as day', () => {
    expect(
      quote(
        { serviceType: 'jump_start', batteryCount: 1 },
        '2026-07-01T10:59:00Z',
      ).period,
    ).toBe('night');
    expect(
      quote(
        { serviceType: 'jump_start', batteryCount: 1 },
        '2026-07-01T11:00:00Z',
      ),
    ).toMatchObject({
      period: 'day',
      totalPayableNowCents: 15000,
    });
    expect(
      quote(
        { serviceType: 'jump_start', batteryCount: 1 },
        '2026-07-01T22:59:00Z',
      ).period,
    ).toBe('day');
    expect(
      quote(
        { serviceType: 'jump_start', batteryCount: 1 },
        '2026-07-01T23:00:00Z',
      ),
    ).toMatchObject({
      period: 'night',
      totalPayableNowCents: 20000,
    });
  });

  it.each([
    [2, 22900],
    [3, 26500],
    [4, 29500],
  ])('prices %i jump-start batteries at %i cents', (batteryCount, total) => {
    expect(
      quote({ serviceType: 'jump_start', batteryCount }).totalPayableNowCents,
    ).toBe(total);
  });

  it('prices tire service and separates replacement tire cost', () => {
    const result = quote({
      serviceType: 'flat_tire',
      resolvedServiceType: 'tire_replace',
      tireSize: '225/65R17',
    });
    expect(result.totalPayableNowCents).toBe(16500);
    expect(result.lineItems[1]).toMatchObject({
      itemCode: 'replacement_tire',
      payableNow: false,
      confirmationRequired: true,
      totalAmountCents: 0,
    });
  });

  it('prices lockout and mechanic day/night rates', () => {
    expect(quote({ serviceType: 'locked_out' }).totalPayableNowCents).toBe(
      15000,
    );
    expect(quote({ serviceType: 'lockout' }).totalPayableNowCents).toBe(
      15000,
    );
    expect(
      quote({ serviceType: 'mechanic_check' }, '2026-07-01T23:00:00Z')
        .totalPayableNowCents,
    ).toBe(30000);
    expect(
      quote(
        { serviceType: 'other', mechanicIssue: 'engine' },
        '2026-07-01T23:00:00Z',
      ).totalPayableNowCents,
    ).toBe(30000);
  });

  it('supports alias service types for fuel delivery and winch-out', () => {
    expect(
      quote({ serviceType: 'fuel_delivery', gallons: 2 }).totalPayableNowCents,
    ).toBe(20700);
    expect(
      quote({ serviceType: 'winch_out', distanceFeet: 10 }).totalPayableNowCents,
    ).toBe(28500);
  });

  it('throws UNLISTED_SERVICE when service cannot be priced online', () => {
    expect(() => quote({ serviceType: 'other' })).toThrowError(
      'This service cannot be priced online.',
    );
    expect(() => quote({ serviceType: 'custom_unknown' })).toThrowError(
      'This service cannot be priced online.',
    );
  });

  it.each([
    [13, 'yes', 27300],
    [20, 'yes', 32900],
    [21, 'yes', 37900],
    [34, 'not_sure', 52900],
  ])(
    'prices %i billable tow miles with neutral=%s at %i cents',
    (routeBillableMiles, neutral, total) => {
      const result = quote({ serviceType: 'tow', routeBillableMiles, neutral });
      expect(result.totalPayableNowCents).toBe(total);
    },
  );

  it('maps the 12.5-mile PDF route to 13 server-rounded billable miles', () => {
    const result = quote({
      serviceType: 'tow',
      routeBillableMiles: 13,
      neutral: 'yes',
    });
    expect(result.lineItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemCode: 'tow_hook',
          totalAmountCents: 16900,
        }),
        expect.objectContaining({
          itemCode: 'tow_mileage',
          quantity: 13,
          unitAmountCents: 800,
          totalAmountCents: 10400,
        }),
      ]),
    );
  });

  it('prices gas payable now and separates dispatcher-confirmed delivery mileage', () => {
    const result = quote({ serviceType: 'out_of_gas', gallons: 2 });
    expect(result.totalPayableNowCents).toBe(20700);
    expect(result.lineItems.at(-1)).toMatchObject({
      itemCode: 'gas_delivery_mileage',
      payableNow: false,
      metadata: { includedMiles: 5, ratePerMileCents: 500 },
    });
  });

  it.each([
    [10, 28500],
    [11, 38500],
    [30, 48500],
  ])('prices a %i-foot winch distance at %i cents', (distanceFeet, total) => {
    expect(
      quote({ serviceType: 'stuck', distanceFeet }).totalPayableNowCents,
    ).toBe(total);
  });

  it('stores version, timezone, effective time, and 30-minute validity', () => {
    const result = quote({ serviceType: 'locked_out' });
    expect(result).toMatchObject({
      currency: 'USD',
      pricingVersion: 2,
      timezone: 'America/New_York',
      pricedAt: '2026-07-01T16:00:00.000Z',
      validUntil: '2026-07-01T16:30:00.000Z',
    });
  });

  it('uses server quote lifetime when the browser clock is ahead', () => {
    expect(
      getQuoteRefreshDelay(
        {
          pricedAt: '2026-07-01T16:00:00.000Z',
          validUntil: '2026-07-01T16:30:00.000Z',
        },
        Date.parse('2026-07-01T17:00:00.000Z'),
      ),
    ).toBe(30 * 60 * 1000);
  });
});
