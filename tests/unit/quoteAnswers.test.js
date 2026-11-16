import { describe, expect, it } from 'vitest';
import { toQuoteWizardAnswers } from '@/features/pricing/utils/quoteAnswers';

const quote = {
  id: '10000000-0000-4000-8000-000000000001',
  status: 'active',
  pricingVersion: 4,
  validUntil: '2026-11-03T12:30:00.000Z',
  totalPayableNowCents: 27300,
};

describe('quote wizard answers', () => {
  it('preserves the active server quote for pay-by-phone handoff', () => {
    expect(toQuoteWizardAnswers(quote, 'pay_by_phone')).toEqual({
      quoteId: quote.id,
      quoteStatus: 'active',
      quotePricingVersion: 4,
      quoteValidUntil: quote.validUntil,
      quoteTotalCents: 27300,
      quoteAction: 'pay_by_phone',
    });
  });
});
