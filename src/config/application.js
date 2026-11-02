const publicCompany = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || 'Roadside Assistance Co.',
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || '+1 555 010 2020',
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || 'support@example.com',
};

export const applicationConfig = Object.freeze({
  locale: 'en-US',
  currency: 'USD',
  country: {
    code: 'US',
    name: 'United States',
    addressRegion: 'us',
  },
  timezone: 'America/New_York',
  company: publicCompany,
  serviceAvailability: {
    enabled: true,
    emergencyServices: false,
    schedule: '24/7',
  },
});

export function formatCurrency(amountInCents) {
  return new Intl.NumberFormat(applicationConfig.locale, {
    style: 'currency',
    currency: applicationConfig.currency,
  }).format(amountInCents / 100);
}
