import { applicationConfig } from '@/config/application';

export const PRICING_KEYS = Object.freeze({
  DAY_START: 'day_start',
  DAY_END: 'day_end',
  QUOTE_VALID_MIN: 'quote_valid_min',
  ROUNDING: 'rounding',
  JS_1_DAY: 'js_1_day',
  JS_1_NIGHT: 'js_1_night',
  JS_2: 'js_2',
  JS_3: 'js_3',
  JS_4: 'js_4',
  JS_MAX_BATTERIES: 'js_max_batteries',
  TIRE_DAY: 'tire_day',
  TIRE_NIGHT: 'tire_night',
  LOCKOUT_DAY: 'lockout_day',
  LOCKOUT_NIGHT: 'lockout_night',
  MECH_DAY: 'mech_day',
  MECH_NIGHT: 'mech_night',
  TOW_HOOK_NEUTRAL_OK: 'tow_hook_neutral_ok',
  TOW_HOOK_NEUTRAL_FAIL: 'tow_hook_neutral_fail',
  TOW_RATE_SHORT: 'tow_rate_short',
  TOW_RATE_LONG: 'tow_rate_long',
  TOW_THRESHOLD_MI: 'tow_threshold_mi',
  TOW_MAX_MI: 'tow_max_mi',
  GAS_BASE: 'gas_base',
  GAS_PRICE_PER_GAL: 'gas_price_per_gal',
  GAS_INCLUDED_MI: 'gas_included_mi',
  GAS_RATE_PER_MI: 'gas_rate_per_mi',
  WINCH_BASE: 'winch_base',
  WINCH_INCLUDED_FT: 'winch_included_ft',
  WINCH_STEP_FT: 'winch_step_ft',
  WINCH_STEP_PRICE: 'winch_step_price',
});

export const REQUIRED_PRICING_KEYS = Object.freeze(Object.values(PRICING_KEYS));

export const pricingPolicy = Object.freeze({
  currency: applicationConfig.currency,
  source: 'server',
  clientTotalsTrusted: false,
});
