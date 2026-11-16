begin;

create extension if not exists pgtap with schema extensions;
select plan(18);

select has_column('public', 'handoff_leads', 'priority', 'hand-off leads track priority');
select has_column('public', 'handoff_leads', 'payment_classification', 'hand-off leads track authoritative payment classification');
select has_column('public', 'handoff_leads', 'requested_action', 'hand-off leads track the customer action');
select has_column('public', 'dispatch_notifications', 'handoff_lead_id', 'the durable outbox supports hand-off leads');
select has_function(
  'public',
  'create_handoff_lead_by_session',
  array['bytea', 'text', 'text'],
  'secure hand-off creation RPC exists'
);
select ok(
  not has_function_privilege('anon', 'public.create_handoff_lead_by_session(bytea,text,text)', 'EXECUTE'),
  'anonymous users cannot create hand-off leads directly'
);
select ok(
  not has_function_privilege('authenticated', 'public.create_handoff_lead_by_session(bytea,text,text)', 'EXECUTE'),
  'authenticated users cannot bypass server hand-off authorization'
);
select ok(
  has_function_privilege('service_role', 'public.create_handoff_lead_by_session(bytea,text,text)', 'EXECUTE'),
  'the server service role can create hand-off leads'
);

insert into public.application_settings (
  setting_scope, company_name, support_phone_e164, dispatch_email,
  default_timezone, messages
) values (
  'default', 'Hand-off Test Roadside', '+15550102020',
  'dispatch@example.com', 'America/New_York',
  '{"handoff_team_emails":{"specialist":"specialist@example.com"}}'::jsonb
) on conflict (setting_scope) do update set
  company_name = excluded.company_name,
  support_phone_e164 = excluded.support_phone_e164,
  dispatch_email = excluded.dispatch_email,
  messages = excluded.messages;

insert into public.customers (
  id, full_name, phone_e164, phone_verified_at
) values (
  'b2000000-0000-4000-8000-000000000002', 'Callback Customer',
  '+15555550198', now()
);

insert into public.booking_sessions (
  id, customer_id, access_token_hash, current_screen, draft_payload, expires_at
) values
  ('b1000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-user', 'sha256'), 'R', '{"answers":{"handoffReason":"USER_REQUEST","fullName":"Guest User","mobileNumber":"(555) 555-0100","isSafe":true}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000002', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-existing', 'sha256'), 'R', '{"answers":{"handoffReason":"EXISTING_JOB"}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000003', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-cancel', 'sha256'), 'R', '{"answers":{"handoffReason":"CANCEL_JOB"}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000004', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-missing', 'sha256'), 'R', '{"answers":{"handoffReason":"MISSING_INFO"}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000005', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-heavy', 'sha256'), 'R', '{"answers":{"handoffReason":"HEAVY_DUTY"}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000006', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-unlisted', 'sha256'), 'R', '{"answers":{"handoffReason":"UNLISTED_SERVICE"}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000007', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-winch', 'sha256'), 'R', '{"answers":{"handoffReason":"WINCH_SPECIALIST"}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000008', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-limit', 'sha256'), 'R', '{"answers":{"handoffReason":"OVER_LIMIT"}}', now() + interval '1 hour'),
  ('b1000000-0000-4000-8000-000000000009', 'b2000000-0000-4000-8000-000000000002', extensions.digest('handoff-phone', 'sha256'), 'R', '{"answers":{"handoffReason":"PAY_BY_PHONE"}}', now() + interval '1 hour');

insert into public.customers (
  id, full_name, phone_e164, phone_verified_at
) values (
  'b2000000-0000-4000-8000-000000000001', 'Paid Customer',
  '+15555550199', now()
);
insert into public.booking_sessions (
  id, customer_id, access_token_hash, current_screen, draft_payload, expires_at
) values (
  'b2100000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  extensions.digest('handoff-paid', 'sha256'), 'R',
  '{"answers":{"handoffReason":"CANCEL_JOB","isSafe":true}}',
  now() + interval '1 hour'
);
insert into public.vehicles (
  id, booking_session_id, customer_id, model_year, make, model
) values (
  'b2200000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001', 2020, 'Ford', 'Escape'
);
insert into public.locations (
  id, booking_session_id, kind, formatted_address, google_place_id,
  latitude, longitude, timezone, is_confirmed, confirmed_at
) values (
  'b2300000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001', 'pickup',
  '100 Main St, Miami, FL 33101', 'paid-handoff-pickup',
  25.7617, -80.1918, 'America/New_York', true, now()
);
insert into public.service_requests (
  id, booking_session_id, vehicle_id, pickup_location_id, service_type
) values (
  'b2400000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001',
  'b2200000-0000-4000-8000-000000000001',
  'b2300000-0000-4000-8000-000000000001', 'jump_start'
);
insert into public.quotes (
  id, booking_session_id, service_request_id, subtotal_cents, tax_cents,
  total_cents, currency, pricing_version, pricing_snapshot, valid_until
) values (
  'b2500000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001',
  'b2400000-0000-4000-8000-000000000001',
  15000, 0, 15000, 'USD', 1, '{"version":1}', now() + interval '30 minutes'
);
insert into public.payments (
  id, quote_id, provider_payment_id, idempotency_key, request_fingerprint,
  amount_cents, currency, status, processed_at
) values (
  'b2600000-0000-4000-8000-000000000001',
  'b2500000-0000-4000-8000-000000000001', 'pi_handoff_paid',
  'payment-intent:handoff-paid:version-1',
  extensions.digest('handoff-paid-payment', 'sha256'),
  15000, 'USD', 'succeeded', now()
);
insert into public.bookings (
  id, customer_id, booking_session_id, service_request_id, quote_id,
  payment_id, payment_status, dispatch_status
) values (
  'b2700000-0000-4000-8000-000000000001',
  'b2000000-0000-4000-8000-000000000001',
  'b2100000-0000-4000-8000-000000000001',
  'b2400000-0000-4000-8000-000000000001',
  'b2500000-0000-4000-8000-000000000001',
  'b2600000-0000-4000-8000-000000000001', 'succeeded', 'ready'
);

select throws_ok(
  $$select public.create_handoff_lead_by_session(
    extensions.digest('different-session', 'sha256'),
    'USER_REQUEST',
    'request_callback'
  )$$,
  'P0002',
  null,
  'a token from another or missing session cannot create a lead'
);

select throws_ok(
  $$select public.create_handoff_lead_by_session(
    extensions.digest('handoff-winch', 'sha256'),
    'WINCH_SPECIALIST',
    'call_now'
  )$$,
  '23514',
  null,
  'winch specialist hand-offs are callback-only'
);

select is(
  public.create_handoff_lead_by_session(
    extensions.digest('handoff-user', 'sha256'),
    'USER_REQUEST',
    'request_callback'
  )->>'paymentClassification',
  'unpaid',
  'browser payment state cannot make an unpaid hand-off paid'
);

select is(
  public.create_handoff_lead_by_session(
    extensions.digest('handoff-paid', 'sha256'),
    'CANCEL_JOB',
    'request_callback'
  )->>'paymentClassification',
  'paid',
  'only a succeeded server booking classifies a hand-off as paid'
);

select is(
  public.create_handoff_lead_by_session(
    extensions.digest('handoff-user', 'sha256'),
    'USER_REQUEST',
    'request_callback'
  )->>'id',
  (select id::text from public.handoff_leads where booking_session_id = 'b1000000-0000-4000-8000-000000000001'),
  'duplicate requests return the same durable lead'
);

select is(
  (select callback_status from public.handoff_leads where booking_session_id = 'b1000000-0000-4000-8000-000000000001'),
  'queued'::public.callback_status,
  'callback requests start in the queued state'
);

do $$
begin
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-existing', 'sha256'), 'EXISTING_JOB', 'request_callback');
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-cancel', 'sha256'), 'CANCEL_JOB', 'request_callback');
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-missing', 'sha256'), 'MISSING_INFO', 'request_callback');
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-heavy', 'sha256'), 'HEAVY_DUTY', 'request_callback');
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-unlisted', 'sha256'), 'UNLISTED_SERVICE', 'request_callback');
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-winch', 'sha256'), 'WINCH_SPECIALIST', 'request_callback');
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-limit', 'sha256'), 'OVER_LIMIT', 'request_callback');
  perform public.create_handoff_lead_by_session(extensions.digest('handoff-phone', 'sha256'), 'PAY_BY_PHONE', 'request_callback');
end;
$$;

select is(
  (select count(*) from public.handoff_leads lead
    join (values
      ('USER_REQUEST', 'Dispatcher'),
      ('EXISTING_JOB', 'Job owner'),
      ('CANCEL_JOB', 'Job owner'),
      ('MISSING_INFO', 'Dispatcher'),
      ('HEAVY_DUTY', 'Heavy-duty team'),
      ('UNLISTED_SERVICE', 'Specialist'),
      ('WINCH_SPECIALIST', 'Specialist'),
      ('OVER_LIMIT', 'Dispatcher'),
      ('PAY_BY_PHONE', 'Dispatcher')
    ) expected(reason_code, assigned_team)
      on expected.reason_code = lead.reason_code
     and expected.assigned_team = lead.assigned_team
    where lead.booking_session_id::text like 'b1000000-0000-4000-8000-00000000000%'),
  9::bigint,
  'all nine reasons are routed to the correct team server-side'
);

select is(
  (select count(*) from public.dispatch_notifications
    where handoff_lead_id is not null and booking_id is null),
  9::bigint,
  'each lead atomically enqueues one booking-independent notification'
);

select is(
  (select recipient from public.dispatch_notifications notification
    join public.handoff_leads lead on lead.id = notification.handoff_lead_id
    where lead.reason_code = 'WINCH_SPECIALIST'),
  'specialist@example.com',
  'configured team recipient overrides the central dispatch inbox'
);

select is(
  (select count(*) from public.dispatch_notifications notification
    join public.handoff_leads lead on lead.id = notification.handoff_lead_id
    where lead.reason_code = 'USER_REQUEST'),
  1::bigint,
  'duplicate lead creation does not duplicate the outbox event'
);

select * from finish();
rollback;
