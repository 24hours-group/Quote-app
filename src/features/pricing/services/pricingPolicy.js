import { applicationConfig } from '@/config/application';

export const pricingPolicy = Object.freeze({
  currency: applicationConfig.currency,
  source: 'server',
  clientTotalsTrusted: false,
});
