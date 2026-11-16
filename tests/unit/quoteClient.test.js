import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAuthoritativeQuote,
  fetchStoredQuote,
  transitionAuthoritativeQuote,
} from '@/features/pricing/services/quoteClient';
import { quoteTransitionRequestSchema } from '@/features/pricing/schemas/quoteSchema';

const quote = {
  id: '00000000-0000-4000-8000-000000000201',
  status: 'accepted',
  acceptedAt: '2026-11-03T12:05:00+00:00',
  currency: 'USD',
  pricingVersion: 2,
  pricedAt: '2026-11-03T12:00:00.000Z',
  validUntil: '2026-11-03T12:30:00.000Z',
  timezone: 'America/New_York',
  period: 'day',
  lineItems: [
    {
      itemCode: 'jump_start',
      description: 'Jump start · 1 battery',
      quantity: 1,
      unitAmountCents: 15000,
      totalAmountCents: 15000,
      payableNow: true,
      confirmationRequired: false,
      metadata: {},
    },
  ],
  totalPayableNowCents: 15000,
  separatelyConfirmedCharges: [],
  summary: {
    customer: {
      fullName: 'Maria Santos',
      phoneE164: '+15555550100',
      phoneVerified: false,
    },
    vehicle: {
      year: 2019,
      make: 'Honda',
      model: 'CR-V',
      isHeavyDuty: false,
    },
    serviceType: 'jump_start',
    pickup: {
      formattedAddress: '1200 N Federal Hwy, Hollywood, FL',
      placeId: 'place-1',
      latitude: 26.021,
      longitude: -80.142,
      timezone: 'America/New_York',
    },
    dropoff: null,
    route: null,
  },
  isAuthoritative: true,
};

afterEach(() => vi.unstubAllGlobals());

describe('quote lifecycle client', () => {
  it('rejects client-supplied amounts from lifecycle requests', () => {
    expect(
      quoteTransitionRequestSchema.safeParse({
        quoteId: quote.id,
        action: 'accept',
        totalPayableNowCents: 1,
      }).success,
    ).toBe(false);
  });

  it('deduplicates concurrent authoritative quote requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: quote }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const answers = { serviceType: 'jump_start', batteryCount: 1 };
    const [first, second] = await Promise.all([
      fetchAuthoritativeQuote(answers),
      fetchAuthoritativeQuote(answers),
    ]);

    expect(first.id).toBe(quote.id);
    expect(second.id).toBe(quote.id);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries one transient quote failure without requiring customer action', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            error: {
              code: 'QUOTE_UNAVAILABLE',
              message: 'Pricing is temporarily unavailable.',
            },
          }),
          { status: 503, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: quote }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      fetchAuthoritativeQuote({ serviceType: 'jump_start', batteryCount: 1 }),
    ).resolves.toMatchObject({ id: quote.id });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('loads the server-stored quote selected for checkout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: quote }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchStoredQuote(quote.id)).resolves.toMatchObject({
      id: quote.id,
      status: 'accepted',
      totalPayableNowCents: 15000,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/booking/quote?quoteId=${quote.id}`,
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('sends only a quote identifier and lifecycle action', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: quote }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await transitionAuthoritativeQuote(quote.id, 'accept');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/booking/quote',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ quoteId: quote.id, action: 'accept' }),
      }),
    );
  });

  it('surfaces expired quote conflicts without accepting a client amount', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            success: false,
            error: { code: 'QUOTE_EXPIRED', message: 'Quote expired.' },
          }),
          { status: 409, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    await expect(
      transitionAuthoritativeQuote(quote.id, 'accept'),
    ).rejects.toMatchObject({ code: 'QUOTE_EXPIRED', status: 409 });
  });
});
