import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const select = vi.fn();
const eq = vi.fn();
const order = vi.fn();
const update = vi.fn();
const insert = vi.fn();
const from = vi.fn(() => ({
  select,
  update,
  insert,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from }),
}));

import {
  getActivePricingConfig,
  updatePricingConfig,
} from '@/features/admin/services/adminPricingService';

describe('adminPricingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActivePricingConfig', () => {
    it('groups active parameters and attaches metadata', async () => {
      const mockRows = [
        {
          parameter_key: 'tow_hook_neutral_ok',
          value: '16900',
          unit: 'cents',
          version: 2,
          is_active: true,
        },
        {
          parameter_key: 'js_1_day',
          value: '15000',
          unit: 'cents',
          version: 2,
          is_active: true,
        },
      ];

      order.mockResolvedValue({ data: mockRows, error: null });
      eq.mockReturnValue({ order });
      select.mockReturnValue({ eq });

      const result = await getActivePricingConfig();

      expect(from).toHaveBeenCalledWith('pricing_parameters');
      expect(result.version).toBe(2);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        key: 'tow_hook_neutral_ok',
        value: 16900,
        unit: 'cents',
        category: 'towing',
        displayUnit: '$',
      });
      expect(result.items[1]).toMatchObject({
        key: 'js_1_day',
        value: 15000,
        unit: 'cents',
        category: 'roadside',
        displayUnit: '$',
      });
    });
  });

  describe('updatePricingConfig', () => {
    it('validates and increments the version when saving pricing changes', async () => {
      const currentRows = [
        { parameter_key: 'day_start', value: 420, unit: 'minutes', version: 2 },
        { parameter_key: 'day_end', value: 1140, unit: 'minutes', version: 2 },
        { parameter_key: 'quote_valid_min', value: 30, unit: 'minutes', version: 2 },
        { parameter_key: 'rounding', value: 1, unit: 'boolean', version: 2 },
        { parameter_key: 'js_1_day', value: 15000, unit: 'cents', version: 2 },
        { parameter_key: 'js_1_night', value: 20000, unit: 'cents', version: 2 },
        { parameter_key: 'js_2', value: 22900, unit: 'cents', version: 2 },
        { parameter_key: 'js_3', value: 26500, unit: 'cents', version: 2 },
        { parameter_key: 'js_4', value: 29500, unit: 'cents', version: 2 },
        { parameter_key: 'js_max_batteries', value: 4, unit: 'count', version: 2 },
        { parameter_key: 'tire_day', value: 16500, unit: 'cents', version: 2 },
        { parameter_key: 'tire_night', value: 20000, unit: 'cents', version: 2 },
        { parameter_key: 'lockout_day', value: 15000, unit: 'cents', version: 2 },
        { parameter_key: 'lockout_night', value: 20000, unit: 'cents', version: 2 },
        { parameter_key: 'mech_day', value: 15000, unit: 'cents', version: 2 },
        { parameter_key: 'mech_night', value: 30000, unit: 'cents', version: 2 },
        { parameter_key: 'tow_hook_neutral_ok', value: 16900, unit: 'cents', version: 2 },
        { parameter_key: 'tow_hook_neutral_fail', value: 18900, unit: 'cents', version: 2 },
        { parameter_key: 'tow_rate_short', value: 800, unit: 'cents_per_mile', version: 2 },
        { parameter_key: 'tow_rate_long', value: 1000, unit: 'cents_per_mile', version: 2 },
        { parameter_key: 'tow_threshold_mi', value: 20, unit: 'miles', version: 2 },
        { parameter_key: 'tow_max_mi', value: 100, unit: 'miles', version: 2 },
        { parameter_key: 'gas_base', value: 19900, unit: 'cents', version: 2 },
        { parameter_key: 'gas_price_per_gal', value: 400, unit: 'cents', version: 2 },
        { parameter_key: 'gas_included_mi', value: 5, unit: 'miles', version: 2 },
        { parameter_key: 'gas_rate_per_mi', value: 500, unit: 'cents_per_mile', version: 2 },
        { parameter_key: 'winch_base', value: 28500, unit: 'cents', version: 2 },
        { parameter_key: 'winch_included_ft', value: 10, unit: 'feet', version: 2 },
        { parameter_key: 'winch_step_ft', value: 10, unit: 'feet', version: 2 },
        { parameter_key: 'winch_step_price', value: 10000, unit: 'cents', version: 2 },
      ];

      // Read current rows
      eq.mockResolvedValue({ data: currentRows, error: null });
      select.mockReturnValue({ eq });

      // Deactivate current
      const updateEq = vi.fn().mockResolvedValue({ error: null });
      update.mockReturnValue({ eq: updateEq });

      // Insert new rows
      insert.mockResolvedValue({ error: null });

      const result = await updatePricingConfig({
        updates: { tow_hook_neutral_ok: 17900 },
        userId: 'admin-user-001',
      });

      expect(result.success).toBe(true);
      expect(result.version).toBe(3);
      expect(insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            parameter_key: 'tow_hook_neutral_ok',
            value: 17900,
            version: 3,
            is_active: true,
          }),
        ]),
      );
    });
  });
});

