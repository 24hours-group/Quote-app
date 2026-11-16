import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { PRICING_KEYS, REQUIRED_PRICING_KEYS } from '@/features/pricing/services/pricingPolicy';

export const PRICING_METADATA = {
  [PRICING_KEYS.TOW_HOOK_NEUTRAL_OK]: {
    label: 'Standard Hook Fee',
    category: 'towing',
    description: 'Base fee for towing when vehicle shifts into neutral normally.',
    displayUnit: '$',
  },
  [PRICING_KEYS.TOW_HOOK_NEUTRAL_FAIL]: {
    label: 'Difficult Hookup Fee (Wheels Locked)',
    category: 'towing',
    description: 'Base fee when vehicle cannot shift to neutral or wheels are locked.',
    displayUnit: '$',
  },
  [PRICING_KEYS.TOW_RATE_SHORT]: {
    label: 'Tow Rate (First 20 Miles)',
    category: 'towing',
    description: 'Per-mile rate charged for the first 20 billable miles.',
    displayUnit: '$/mi',
  },
  [PRICING_KEYS.TOW_RATE_LONG]: {
    label: 'Tow Rate (Beyond 20 Miles)',
    category: 'towing',
    description: 'Per-mile rate charged for long-distance miles beyond 20 miles.',
    displayUnit: '$/mi',
  },
  [PRICING_KEYS.TOW_THRESHOLD_MI]: {
    label: 'Short Distance Threshold',
    category: 'towing',
    description: 'Mileage threshold separating short and long distance pricing.',
    displayUnit: 'miles',
  },
  [PRICING_KEYS.TOW_MAX_MI]: {
    label: 'Maximum Tow Distance',
    category: 'towing',
    description: 'Maximum towing distance supported through the web flow.',
    displayUnit: 'miles',
  },
  [PRICING_KEYS.JS_1_DAY]: {
    label: 'Jump Start (Daytime)',
    category: 'roadside',
    description: 'Flat fee for daytime single-battery jump start service.',
    displayUnit: '$',
  },
  [PRICING_KEYS.JS_1_NIGHT]: {
    label: 'Jump Start (Nighttime)',
    category: 'roadside',
    description: 'Emergency nighttime battery jump start flat rate.',
    displayUnit: '$',
  },
  [PRICING_KEYS.TIRE_DAY]: {
    label: 'Flat Tire Change (Daytime)',
    category: 'roadside',
    description: 'Flat fee for daytime spare tire installation.',
    displayUnit: '$',
  },
  [PRICING_KEYS.TIRE_NIGHT]: {
    label: 'Flat Tire Change (Nighttime)',
    category: 'roadside',
    description: 'Nighttime emergency flat tire change rate.',
    displayUnit: '$',
  },
  [PRICING_KEYS.LOCKOUT_DAY]: {
    label: 'Lockout Service (Daytime)',
    category: 'roadside',
    description: 'Vehicle door unlocking during normal daytime hours.',
    displayUnit: '$',
  },
  [PRICING_KEYS.LOCKOUT_NIGHT]: {
    label: 'Lockout Service (Nighttime)',
    category: 'roadside',
    description: 'Nighttime emergency vehicle lockout service.',
    displayUnit: '$',
  },
  [PRICING_KEYS.WINCH_BASE]: {
    label: 'Winching / Pull-out Base Fee',
    category: 'roadside',
    description: 'Recovery from ditch, snow, or mud (includes first 10 ft).',
    displayUnit: '$',
  },
  [PRICING_KEYS.WINCH_STEP_PRICE]: {
    label: 'Winch Additional Cable Fee',
    category: 'roadside',
    description: 'Fee per additional 10 ft of winch cable used.',
    displayUnit: '$',
  },
  [PRICING_KEYS.GAS_BASE]: {
    label: 'Fuel Delivery Dispatch Fee',
    category: 'roadside',
    description: 'Base dispatch fee for emergency fuel delivery.',
    displayUnit: '$',
  },
  [PRICING_KEYS.GAS_PRICE_PER_GAL]: {
    label: 'Fuel Price per Gallon',
    category: 'roadside',
    description: 'Fuel cost added per gallon delivered.',
    displayUnit: '$',
  },
  [PRICING_KEYS.DAY_START]: {
    label: 'Daytime Schedule Begins',
    category: 'schedule',
    description: 'Minute of the day when daytime rates apply (e.g. 420 = 7:00 AM).',
    displayUnit: 'min',
  },
  [PRICING_KEYS.DAY_END]: {
    label: 'Daytime Schedule Ends',
    category: 'schedule',
    description: 'Minute of the day when nighttime rates begin (e.g. 1140 = 7:00 PM).',
    displayUnit: 'min',
  },
  [PRICING_KEYS.QUOTE_VALID_MIN]: {
    label: 'Quote Expiration Time',
    category: 'schedule',
    description: 'Minutes customer quote remains guaranteed before expiring.',
    displayUnit: 'min',
  },
};

export async function getActivePricingConfig() {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('pricing_parameters')
    .select('parameter_key, value, unit, version, effective_from, effective_to, is_active')
    .eq('is_active', true)
    .order('parameter_key', { ascending: true });

  if (error) {
    throw new Error(`Failed to load pricing parameters: ${error.message}`);
  }

  const items = (data || []).map((row) => {
    const meta = PRICING_METADATA[row.parameter_key] || {
      label: row.parameter_key.replaceAll('_', ' '),
      category: 'other',
      description: '',
      displayUnit: row.unit,
    };
    return {
      key: row.parameter_key,
      value: Number(row.value),
      unit: row.unit,
      version: Number(row.version),
      label: meta.label,
      category: meta.category,
      description: meta.description,
      displayUnit: meta.displayUnit,
    };
  });

  const version = items[0]?.version || 1;
  return { version, items };
}

export async function updatePricingConfig({ updates, userId }) {
  const supabase = createSupabaseAdminClient();
  const { data: current, error: currentError } = await supabase
    .from('pricing_parameters')
    .select('parameter_key, value, unit, version')
    .eq('is_active', true);

  if (currentError) {
    throw new Error(`Failed to read current pricing: ${currentError.message}`);
  }

  const currentMap = Object.fromEntries(
    current.map((item) => [item.parameter_key, item]),
  );

  const nextVersion = (current[0]?.version || 1) + 1;
  const now = new Date().toISOString();

  // Validate all required keys
  for (const key of REQUIRED_PRICING_KEYS) {
    if (updates[key] === undefined && !currentMap[key]) {
      throw new Error(`Missing required pricing key: ${key}`);
    }
  }

  const newRows = REQUIRED_PRICING_KEYS.map((key) => {
    const existing = currentMap[key];
    const value = updates[key] !== undefined ? Number(updates[key]) : Number(existing.value);
    const unit = existing ? existing.unit : 'cents';

    if (isNaN(value) || value < 0) {
      throw new Error(`Invalid positive value for pricing key ${key}`);
    }

    return {
      parameter_key: key,
      value,
      unit,
      version: nextVersion,
      effective_from: now,
      is_active: true,
      created_by: userId || null,
      created_at: now,
      updated_at: now,
    };
  });

  // Deactivate current active rows
  const { error: deactivateError } = await supabase
    .from('pricing_parameters')
    .update({ is_active: false, effective_to: now, updated_at: now })
    .eq('is_active', true);

  if (deactivateError) {
    throw new Error(`Failed to deactivate prior pricing: ${deactivateError.message}`);
  }

  // Insert new version rows
  const { error: insertError } = await supabase
    .from('pricing_parameters')
    .insert(newRows);

  if (insertError) {
    throw new Error(`Failed to insert updated pricing: ${insertError.message}`);
  }

  return { success: true, version: nextVersion };
}

