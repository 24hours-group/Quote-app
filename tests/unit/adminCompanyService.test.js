import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const select = vi.fn();
const eq = vi.fn();
const maybeSingle = vi.fn();
const single = vi.fn();
const upsert = vi.fn();
const from = vi.fn(() => ({
  select,
  upsert,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: () => ({ from }),
}));

import {
  getCompanySettings,
  updateCompanySettings,
  validateCompanySettings,
  isValidIanaTimezone,
  normalizeSupportPhone,
} from '@/features/admin/services/adminCompanyService';
import { canManageCompanySettings } from '@/features/admin/services/authorization';

describe('adminCompanyService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('canManageCompanySettings', () => {
    it('only allows super_admin to manage company settings', () => {
      expect(canManageCompanySettings('super_admin')).toBe(true);
      expect(canManageCompanySettings('operations_admin')).toBe(false);
      expect(canManageCompanySettings('dispatcher')).toBe(false);
      expect(canManageCompanySettings('support')).toBe(false);
      expect(canManageCompanySettings('finance')).toBe(false);
    });
  });

  describe('validation helpers', () => {
    it('validates IANA timezones accurately', () => {
      expect(isValidIanaTimezone('America/New_York')).toBe(true);
      expect(isValidIanaTimezone('America/Chicago')).toBe(true);
      expect(isValidIanaTimezone('UTC')).toBe(true);
      expect(isValidIanaTimezone('Invalid/Timezone_Not_Real')).toBe(false);
      expect(isValidIanaTimezone('')).toBe(false);
      expect(isValidIanaTimezone(null)).toBe(false);
    });

    it('normalizes phone numbers to E.164', () => {
      expect(normalizeSupportPhone('+18005550142')).toBe('+18005550142');
      expect(normalizeSupportPhone('(800) 555-0142')).toBe('+18005550142');
      expect(normalizeSupportPhone('800-555-0142')).toBe('+18005550142');
      expect(() => normalizeSupportPhone('123')).toThrow();
    });

    it('validates complete settings payload', () => {
      const valid = validateCompanySettings({
        company_name: 'Townexa Towing',
        support_phone: '(800) 555-0142',
        dispatch_email: 'dispatch@townexa.com',
        default_timezone: 'America/New_York',
        messages: {
          manual_review: 'Specialist dispatched.',
        },
      });

      expect(valid.isValid).toBe(true);
      expect(valid.data.company_name).toBe('Townexa Towing');
      expect(valid.data.support_phone_e164).toBe('+18005550142');
      expect(valid.data.dispatch_email).toBe('dispatch@townexa.com');
      expect(valid.data.default_timezone).toBe('America/New_York');
      expect(valid.data.messages.manual_review).toBe('Specialist dispatched.');
    });

    it('catches invalid fields', () => {
      const invalid = validateCompanySettings({
        company_name: '',
        support_phone: 'bad-phone',
        dispatch_email: 'not-an-email',
        default_timezone: 'Fake/Zone',
      });

      expect(invalid.isValid).toBe(false);
      expect(invalid.errors.company_name).toBeDefined();
      expect(invalid.errors.support_phone).toBeDefined();
      expect(invalid.errors.dispatch_email).toBeDefined();
      expect(invalid.errors.default_timezone).toBeDefined();
    });
  });

  describe('getCompanySettings', () => {
    it('returns loaded settings when row exists', async () => {
      const mockSettings = {
        id: 'mock-id',
        setting_scope: 'default',
        company_name: 'Townexa',
        support_phone_e164: '+18005550142',
        dispatch_email: 'dispatch@townexa.com',
        default_timezone: 'America/New_York',
        messages: {
          manual_review: 'Specialist will call you.',
        },
      };

      maybeSingle.mockResolvedValue({ data: mockSettings, error: null });
      eq.mockReturnValue({ maybeSingle });
      select.mockReturnValue({ eq });

      const result = await getCompanySettings('default');
      expect(result.company_name).toBe('Townexa');
      expect(result.support_phone_e164).toBe('+18005550142');
      expect(result.messages.manual_review).toBe('Specialist will call you.');
    });

    it('returns default fallback when no row exists', async () => {
      maybeSingle.mockResolvedValue({ data: null, error: null });
      eq.mockReturnValue({ maybeSingle });
      select.mockReturnValue({ eq });

      const result = await getCompanySettings('default');
      expect(result.company_name).toBe('Townexa');
      expect(result.dispatch_email).toBe('dispatch@townexa.com');
      expect(result.messages.quote_expired).toBeDefined();
    });
  });

  describe('updateCompanySettings', () => {
    it('throws when payload is invalid', async () => {
      await expect(
        updateCompanySettings({
          updates: { company_name: '' },
          updatedByUserId: 'user-1',
        }),
      ).rejects.toThrow();
    });

    it('persists valid updates via upsert', async () => {
      const mockUpdated = {
        id: 'mock-id',
        setting_scope: 'default',
        company_name: 'New Name',
        support_phone_e164: '+18005550142',
        dispatch_email: 'team@townexa.com',
        default_timezone: 'America/Chicago',
        messages: {},
      };

      single.mockResolvedValue({ data: mockUpdated, error: null });
      select.mockReturnValue({ single });
      upsert.mockReturnValue({ select });

      const result = await updateCompanySettings({
        updates: {
          company_name: 'New Name',
          support_phone: '+18005550142',
          dispatch_email: 'team@townexa.com',
          default_timezone: 'America/Chicago',
        },
        updatedByUserId: 'user-1',
      });

      expect(result.company_name).toBe('New Name');
      expect(upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          company_name: 'New Name',
          dispatch_email: 'team@townexa.com',
          default_timezone: 'America/Chicago',
          setting_scope: 'default',
          updated_by: 'user-1',
        }),
        { onConflict: 'setting_scope' },
      );
    });
  });
});

