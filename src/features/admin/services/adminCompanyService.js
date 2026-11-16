import 'server-only';

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { normalizeUsPhoneNumber } from '@/features/booking/schemas/contactSchema';
import { DEFAULT_COMPANY_MESSAGES } from '@/features/admin/constants/companySettings';

export function isValidIanaTimezone(timeZone) {
  if (!timeZone || typeof timeZone !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function normalizeSupportPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    throw new Error('Support phone number is required.');
  }

  const trimmed = phone.trim();

  // If already full international E.164 format (+[1-9][0-9]{7,14})
  if (/^\+[1-9]\d{7,14}$/.test(trimmed)) {
    return trimmed;
  }

  // Attempt US phone number normalization
  try {
    return normalizeUsPhoneNumber(trimmed);
  } catch {
    throw new Error(
      'Enter a valid phone number (e.g. +1 800-555-0142 or (800) 555-0142).',
    );
  }
}

export function validateCompanySettings(payload) {
  const errors = {};
  const {
    company_name,
    support_phone,
    support_phone_e164,
    dispatch_email,
    default_timezone,
    messages,
  } = payload || {};

  const trimmedName =
    typeof company_name === 'string' ? company_name.trim() : '';
  if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 160) {
    errors.company_name = 'Company name must be between 1 and 160 characters.';
  }

  let normalizedPhone = '';
  const phoneToTest = support_phone_e164 || support_phone;
  try {
    normalizedPhone = normalizeSupportPhone(phoneToTest);
  } catch (err) {
    errors.support_phone = err.message;
  }

  const trimmedEmail =
    typeof dispatch_email === 'string' ? dispatch_email.trim().toLowerCase() : '';
  const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
  if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
    errors.dispatch_email = 'Enter a valid dispatch email address.';
  }

  const tz =
    typeof default_timezone === 'string' ? default_timezone.trim() : '';
  if (!tz || !isValidIanaTimezone(tz)) {
    errors.default_timezone =
      'Select a valid IANA timezone (e.g. America/New_York).';
  }

  let sanitizedMessages = { ...DEFAULT_COMPANY_MESSAGES };
  if (messages && typeof messages === 'object' && !Array.isArray(messages)) {
    for (const [k, v] of Object.entries(messages)) {
      if (typeof v === 'string') {
        sanitizedMessages[k] = v.trim();
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    data: {
      company_name: trimmedName,
      support_phone_e164: normalizedPhone,
      dispatch_email: trimmedEmail,
      default_timezone: tz,
      messages: sanitizedMessages,
    },
  };
}

export async function getCompanySettings(scope = 'default') {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('application_settings')
    .select(
      'id, setting_scope, company_name, support_phone_e164, dispatch_email, default_timezone, messages, updated_at, updated_by',
    )
    .eq('setting_scope', scope)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load company settings: ${error.message}`);
  }

  if (!data) {
    return {
      id: null,
      setting_scope: scope,
      company_name: 'Townexa',
      support_phone_e164: '+18005550142',
      dispatch_email: 'dispatch@townexa.com',
      default_timezone: 'America/New_York',
      messages: { ...DEFAULT_COMPANY_MESSAGES },
      updated_at: null,
      updated_by: null,
    };
  }

  return {
    ...data,
    messages: {
      ...DEFAULT_COMPANY_MESSAGES,
      ...(data.messages || {}),
    },
  };
}

export async function updateCompanySettings({
  updates,
  updatedByUserId,
  scope = 'default',
}) {
  const validation = validateCompanySettings(updates);
  if (!validation.isValid) {
    const errorMsg = Object.values(validation.errors).join(' ');
    const err = new Error(errorMsg);
    err.fieldErrors = validation.errors;
    throw err;
  }

  const supabase = createSupabaseAdminClient();
  const payload = {
    ...validation.data,
    setting_scope: scope,
    updated_by: updatedByUserId || null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('application_settings')
    .upsert(payload, { onConflict: 'setting_scope' })
    .select(
      'id, setting_scope, company_name, support_phone_e164, dispatch_email, default_timezone, messages, updated_at, updated_by',
    )
    .single();

  if (error) {
    throw new Error(`Failed to save company settings: ${error.message}`);
  }

  return data;
}

