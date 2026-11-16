export function toQuoteWizardAnswers(quote, quoteAction) {
  return {
    quoteId: quote.id,
    quoteStatus: quote.status,
    quotePricingVersion: quote.pricingVersion,
    quoteValidUntil: quote.validUntil,
    quoteTotalCents: quote.totalPayableNowCents,
    quoteAction,
  };
}
