begin;

create extension if not exists pgtap with schema extensions;
select plan(15);

insert into public.application_settings (
  setting_scope, company_name, support_phone_e164, dispatch_email, default_timezone
) values (
  'default', 'Stripe Test Roadside', '+15550102020', 'dispatch@example.com', 'America/New_York'
) on conflict (setting_scope) do update set dispatch_email = excluded.dispatch_email;

insert into public.customers (
  id, full_name, phone_e164, phone_verified_at, receipt_email
) values (
  'a0000000-0000-4000-8000-000000000001',
  'Stripe Test Customer',
  '+15550102099',
  now(),
  'customer@example.com'
);

insert into public.booking_sessions (
  id, customer_id, access_token_hash, request_type, expires_at
) values (
  'a1000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  extensions.digest('stripe-session-token', 'sha256'),
  'towing',
  now() + interval '1 hour'
);

insert into public.vehicles (
  id, booking_session_id, customer_id, model_year, make, model
) values (
  'a2000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  2021,
  'Honda',
  'Accord'
);

insert into public.locations (
  id, booking_session_id, kind, formatted_address, google_place_id,
  latitude, longitude, timezone, is_confirmed, confirmed_at
) values
  (
    'a3000000-0000-4000-8000-000000000001',
    'a1000000-0000-4000-8000-000000000001',
    'pickup',
    '100 Main St, Miami, FL 33101',
    'stripe-pickup',
    25.7617,
    -80.1918,
    'America/New_York',
    true,
    now()
  ),
  (
    'a3000000-0000-4000-8000-000000000002',
    'a1000000-0000-4000-8000-000000000001',
    'dropoff',
    '200 Main St, Miami, FL 33101',
    'stripe-dropoff',
    25.7717,
    -80.1818,
    'America/New_York',
    true,
    now()
  );

insert into public.service_requests (
  id, booking_session_id, vehicle_id, pickup_location_id,
  dropoff_location_id, service_type
) values (
  'a4000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a2000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000001',
  'a3000000-0000-4000-8000-000000000002',
  'tow'
);

insert into public.quotes (
  id, booking_session_id, service_request_id, subtotal_cents, tax_cents,
  total_cents, currency, pricing_version, pricing_snapshot, valid_until
) values (
  'a5000000-0000-4000-8000-000000000001',
  'a1000000-0000-4000-8000-000000000001',
  'a4000000-0000-4000-8000-000000000001',
  27300,
  0,
  27300,
  'USD',
  1,
  '{"version":1,"parameters":{"tow.hook":16900,"tow.mile":800}}'::jsonb,
  now() + interval '30 minutes'
);

insert into public.quote_line_items (
  quote_id, item_code, description, quantity, unit_amount_cents, total_amount_cents
) values (
  'a5000000-0000-4000-8000-000000000001',
  'total',
  'Roadside towing',
  1,
  27300,
  27300
);

set constraints all immediate;
set constraints all deferred;

update public.quotes set status = 'offered'
where id = 'a5000000-0000-4000-8000-000000000001';
update public.quotes set status = 'accepted', accepted_at = now()
where id = 'a5000000-0000-4000-8000-000000000001';

select throws_ok(
  $$select public.reserve_session_payment_attempt(
    extensions.digest('other-session-token', 'sha256'),
    'a5000000-0000-4000-8000-000000000001',
    'payment-intent:a5000000-0000-4000-8000-000000000001:v1',
    extensions.digest('stripe-payment-fingerprint', 'sha256')
  )$$,
  'P0002',
  null,
  'a different session cannot reserve the payment'
);

select is(
  (public.reserve_session_payment_attempt(
    extensions.digest('stripe-session-token', 'sha256'),
    'a5000000-0000-4000-8000-000000000001',
    'payment-intent:a5000000-0000-4000-8000-000000000001:v1',
    extensions.digest('stripe-payment-fingerprint', 'sha256')
  )).amount_cents,
  27300,
  'payment reservation copies the immutable quote total'
);

select is(
  (public.reserve_session_payment_attempt(
    extensions.digest('stripe-session-token', 'sha256'),
    'a5000000-0000-4000-8000-000000000001',
    'payment-intent:a5000000-0000-4000-8000-000000000001:v1',
    extensions.digest('stripe-payment-fingerprint', 'sha256')
  )).id,
  (select id from public.payments where quote_id = 'a5000000-0000-4000-8000-000000000001'),
  'payment reservation is idempotent'
);

select is(
  (public.bind_session_payment_provider_id(
    extensions.digest('stripe-session-token', 'sha256'),
    (select id from public.payments where quote_id = 'a5000000-0000-4000-8000-000000000001'),
    'pi_stripe_test_001'
  )).provider_payment_id,
  'pi_stripe_test_001',
  'Stripe Payment Intent identity is bound once'
);

select lives_ok(
  $$select public.apply_stripe_payment_event(
    'evt_stripe_processing_001',
    'payment_intent.processing',
    extensions.digest('processing-payload', 'sha256'),
    'pi_stripe_test_001',
    'processing',
    null,
    null
  )$$,
  'a processing event is recorded without finalizing a booking'
);

select is(
  (select count(*) from public.bookings where quote_id = 'a5000000-0000-4000-8000-000000000001'),
  0::bigint,
  'processing does not create a booking'
);

select throws_ok(
  $$select public.apply_stripe_payment_event(
    'evt_stripe_wrong_amount_001',
    'payment_intent.succeeded',
    extensions.digest('wrong-amount-payload', 'sha256'),
    'pi_stripe_test_001',
    'succeeded',
    1,
    'USD'
  )$$,
  '23514',
  null,
  'a mismatched successful amount is rejected'
);

select is(
  (select booking_reference from public.apply_stripe_payment_event(
    'evt_stripe_succeeded_001',
    'payment_intent.succeeded',
    extensions.digest('succeeded-payload', 'sha256'),
    'pi_stripe_test_001',
    'succeeded',
    27300,
    'USD'
  )),
  (select reference from public.bookings where quote_id = 'a5000000-0000-4000-8000-000000000001'),
  'verified success atomically creates the booking'
);

select is(
  (select count(*) from public.dispatch_notifications notification
    join public.bookings booking on booking.id = notification.booking_id
    where booking.quote_id = 'a5000000-0000-4000-8000-000000000001'
      and notification.event_name = 'booking.paid'),
  1::bigint,
  'verified success enqueues exactly one dispatch notification'
);

select is(
  (select count(*) from public.apply_stripe_payment_event(
    'evt_stripe_succeeded_001',
    'payment_intent.succeeded',
    extensions.digest('succeeded-payload', 'sha256'),
    'pi_stripe_test_001',
    'succeeded',
    27300,
    'USD'
  )),
  1::bigint,
  'duplicate verified webhook delivery returns the existing result'
);

select is(
  (select count(*) from public.dispatch_notifications notification
    join public.bookings booking on booking.id = notification.booking_id
    where booking.quote_id = 'a5000000-0000-4000-8000-000000000001'
      and notification.event_name = 'booking.paid.customer_receipt'),
  1::bigint,
  'verified success atomically enqueues one customer email receipt'
);

select is(
  (select payload->'booking'->>'reference'
    from public.dispatch_notifications
    where event_name = 'booking.paid'),
  (select reference from public.bookings where quote_id = 'a5000000-0000-4000-8000-000000000001'),
  'outbox stores an immutable paid-booking payload snapshot'
);

select is(
  (select count(*) from public.claim_dispatch_notifications(10, 60)),
  2::bigint,
  'the worker atomically claims dispatch and receipt rows once'
);

select is(
  (public.mark_dispatch_notification_delivered(
    (select id from public.dispatch_notifications where event_name = 'booking.paid'),
    (select lease_token from public.dispatch_notifications where event_name = 'booking.paid'),
    'resend',
    'email_dispatch_test_001'
  )).delivery_status,
  'delivered'::public.delivery_status,
  'successful dispatch delivery is recorded'
);

select is(
  (public.mark_dispatch_notification_failed(
    (select id from public.dispatch_notifications where event_name = 'booking.paid.customer_receipt'),
    (select lease_token from public.dispatch_notifications where event_name = 'booking.paid.customer_receipt'),
    'resend',
    'resend_unavailable',
    false
  )).delivery_status,
  'failed'::public.delivery_status,
  'provider outage schedules the customer receipt for retry'
);

select * from finish();
rollback;
