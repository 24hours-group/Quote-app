const quoteByService = {
  jump_start: {
    lineItems: [{ label: 'Jump-start service', amountCents: 15000 }],
    totalCents: 15000,
  },
  flat_tire: {
    lineItems: [{ label: 'Tire service', amountCents: 16500 }],
    totalCents: 16500,
  },
  tire_change: {
    lineItems: [{ label: 'Tire change service', amountCents: 16500 }],
    totalCents: 16500,
  },
  tire_replace: {
    lineItems: [
      { label: 'Tire replacement service', amountCents: 16500 },
      { label: 'Tire cost', note: 'Confirmed by dispatcher', amountCents: 0 },
    ],
    totalCents: 16500,
  },
  locked_out: {
    lineItems: [{ label: 'Lockout service', amountCents: 15000 }],
    totalCents: 15000,
  },
  tow: {
    lineItems: [
      { label: 'Hook fee', amountCents: 16900 },
      { label: 'Mileage estimate', amountCents: 10400 },
    ],
    totalCents: 27300,
  },
  out_of_gas: {
    lineItems: [
      { label: 'Fuel delivery base', amountCents: 19900 },
      { label: 'Fuel estimate', amountCents: 800 },
    ],
    totalCents: 20700,
  },
  mechanic_check: {
    lineItems: [{ label: 'On-site assessment', amountCents: 15000 }],
    totalCents: 15000,
  },
  stuck: {
    lineItems: [{ label: 'Winch-out service', amountCents: 28500 }],
    totalCents: 28500,
  },
};

export function getMockQuoteForService(serviceType) {
  const quote = quoteByService[serviceType] || quoteByService.mechanic_check;

  return {
    id: `mock-${serviceType || 'service'}-quote`,
    currency: 'USD',
    periodLabel: 'Day rate (7 AM–7 PM)',
    pricingVersion: 'mock-v1',
    isAuthoritative: false,
    ...quote,
  };
}
