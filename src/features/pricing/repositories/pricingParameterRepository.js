import 'server-only';

import { REQUIRED_PRICING_KEYS } from '@/features/pricing/services/pricingPolicy';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';

export class PricingConfigurationError extends Error {
  constructor(
    message = 'The active pricing configuration is incomplete.',
    cause,
  ) {
    super(message, { cause });
    this.name = 'PricingConfigurationError';
  }
}

export async function loadActivePricingParameters(asOf = new Date()) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('pricing_parameters')
    .select('parameter_key, value, unit, version, effective_from, effective_to')
    .eq('is_active', true);
  if (error) {
    throw new PricingConfigurationError(
      'The active pricing configuration could not be loaded.',
      error,
    );
  }

  const active = (data || []).filter((row) => {
    const starts = Date.parse(row.effective_from) <= asOf.getTime();
    const ends =
      !row.effective_to || Date.parse(row.effective_to) > asOf.getTime();
    return starts && ends;
  });
  const versions = new Set(active.map((row) => Number(row.version)));
  if (versions.size !== 1) {
    throw new PricingConfigurationError(
      'Active pricing keys do not share one version.',
    );
  }
  const parameters = Object.fromEntries(
    active.map((row) => [
      row.parameter_key,
      { ...row, value: Number(row.value), version: Number(row.version) },
    ]),
  );
  if (REQUIRED_PRICING_KEYS.some((key) => !parameters[key])) {
    throw new PricingConfigurationError();
  }
  return { version: [...versions][0], parameters };
}
