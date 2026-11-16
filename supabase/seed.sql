-- Development and test data only. Replace all operational values before production.

insert into public.application_settings (
  id,
  setting_scope,
  company_name,
  support_phone_e164,
  dispatch_email,
  default_timezone,
  messages
) values (
  '10000000-0000-4000-8000-000000000001',
  'default',
  'Roadside Assistance Co.',
  '+15550102020',
  'dispatch@example.com',
  'America/New_York',
  jsonb_build_object(
    'quote_expired', 'This quote has expired. Request a new quote to continue.',
    'manual_review', 'A roadside specialist will call you shortly.',
    'payment_pending', 'Your payment is still being confirmed.'
  )
)
on conflict (setting_scope) do update set
  company_name = excluded.company_name,
  support_phone_e164 = excluded.support_phone_e164,
  dispatch_email = excluded.dispatch_email,
  default_timezone = excluded.default_timezone,
  messages = excluded.messages;

-- Authoritative pricing version 2 is installed by
-- 20261103000800_authoritative_pricing.sql so reset and production use the
-- same immutable parameter set.
