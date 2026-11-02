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

insert into public.pricing_parameters (
  id,
  parameter_key,
  value,
  unit,
  version,
  effective_from,
  is_active
) values
  ('20000000-0000-4000-8000-000000000001', 'tow.base_fee', 9500, 'cents', 1, '2026-01-01T00:00:00Z', true),
  ('20000000-0000-4000-8000-000000000002', 'tow.per_mile', 650, 'cents_per_mile', 1, '2026-01-01T00:00:00Z', true),
  ('20000000-0000-4000-8000-000000000003', 'roadside.jump_start', 7500, 'cents', 1, '2026-01-01T00:00:00Z', true),
  ('20000000-0000-4000-8000-000000000004', 'roadside.tire_change', 8500, 'cents', 1, '2026-01-01T00:00:00Z', true),
  ('20000000-0000-4000-8000-000000000005', 'heavy_duty.surcharge', 5000, 'cents', 1, '2026-01-01T00:00:00Z', true),
  ('20000000-0000-4000-8000-000000000006', 'quote.validity_minutes', 15, 'minutes', 1, '2026-01-01T00:00:00Z', true)
on conflict (parameter_key, version) do nothing;
