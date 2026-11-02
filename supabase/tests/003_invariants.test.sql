begin;

create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.customers (
  id, full_name, phone_e164, phone_verified_at
) values (
  '60000000-0000-4000-8000-000000000001',
  'Invariant Test Customer',
  '+15550102022',
  now()
);

insert into public.booking_sessions (
  id, customer_id, access_token_hash, request_type, expires_at
) values (
  '61000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  extensions.digest('invariant-test-session', 'sha256'),
  'towing',
  now() + interval '1 hour'
);

insert into public.vehicles (
  id, booking_session_id, customer_id, model_year, make, model
) values (
  '62000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000001',
  2022,
  'Ford',
  'Escape'
);

insert into public.locations (
  id, booking_session_id, kind, formatted_address, google_place_id,
  latitude, longitude, timezone, is_confirmed, confirmed_at
) values
  (
    '63000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    'pickup',
    '100 Main St, Austin, TX 78701',
    'test-pickup-place',
    30.267153,
    -97.743057,
    'America/Chicago',
    true,
    now()
  ),
  (
    '63000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    'dropoff',
    '200 Congress Ave, Austin, TX 78701',
    'test-dropoff-place',
    30.264900,
    -97.742800,
    'America/Chicago',
    true,
    now()
  );

insert into public.service_requests (
  id, booking_session_id, vehicle_id, pickup_location_id,
  dropoff_location_id, service_type
) values (
  '64000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '62000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000001',
  '63000000-0000-4000-8000-000000000002',
  'tow'
);

insert into public.quotes (
  id, booking_session_id, service_request_id, subtotal_cents, tax_cents,
  total_cents, currency, pricing_version, pricing_snapshot, valid_until
) values (
  '65000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000001',
  12500,
  1000,
  13500,
  'USD',
  1,
  '{"version":1,"parameters":{"tow.base_fee":9500,"tow.per_mile":650}}'::jsonb,
  now() + interval '15 minutes'
);

insert into public.quote_line_items (
  quote_id, item_code, description, quantity, unit_amount_cents, total_amount_cents
) values
  ('65000000-0000-4000-8000-000000000001', 'base_fee', 'Base towing fee', 1, 9500, 9500),
  ('65000000-0000-4000-8000-000000000001', 'mileage', 'Mileage', 5, 600, 3000);

set constraints all immediate;
select pass('valid quote line items equal the immutable subtotal');
set constraints all deferred;

update public.quotes
set status = 'offered'
where id = '65000000-0000-4000-8000-000000000001';

update public.quotes
set status = 'accepted', accepted_at = now()
where id = '65000000-0000-4000-8000-000000000001';

select throws_ok(
  $$update public.quotes set total_cents = 14000 where id = '65000000-0000-4000-8000-000000000001'$$,
  '23000',
  null,
  'quote monetary snapshot cannot be changed'
);

select throws_ok(
  $$insert into public.payments (
    quote_id, idempotency_key, request_fingerprint, amount_cents, currency
  ) values (
    '65000000-0000-4000-8000-000000000001',
    'payment-wrong-amount-key',
    extensions.digest('wrong', 'sha256'),
    12000,
    'USD'
  )$$,
  '23514',
  null,
  'payment amount must match quote total'
);

insert into public.payments (
  id, quote_id, idempotency_key, request_fingerprint,
  amount_cents, currency, status, processed_at
) values (
  '66000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000001',
  'payment-invariant-test-key',
  extensions.digest('valid-payment-request', 'sha256'),
  13500,
  'USD',
  'succeeded',
  now()
);

select is(
  (public.create_payment_attempt(
    '65000000-0000-4000-8000-000000000001',
    'payment-invariant-test-key',
    extensions.digest('valid-payment-request', 'sha256')
  )).id::text,
  '66000000-0000-4000-8000-000000000001',
  'matching payment retry returns the original payment'
);

select throws_ok(
  $$select public.create_payment_attempt(
    '65000000-0000-4000-8000-000000000001',
    'payment-invariant-test-key',
    extensions.digest('conflicting-payment-request', 'sha256')
  )$$,
  '23505',
  null,
  'conflicting payment idempotency retry is rejected'
);

select lives_ok(
  $$select public.record_payment_provider_event(
    '66000000-0000-4000-8000-000000000001',
    'evt_invariant_001',
    'checkout.session.completed',
    extensions.digest('provider-event-payload', 'sha256')
  )$$,
  'first provider event is recorded'
);

select is(
  (public.record_payment_provider_event(
    '66000000-0000-4000-8000-000000000001',
    'evt_invariant_001',
    'checkout.session.completed',
    extensions.digest('provider-event-payload', 'sha256')
  )).provider_event_id,
  'evt_invariant_001',
  'matching provider event replay returns the original event'
);

select throws_ok(
  $$select public.record_payment_provider_event(
    '66000000-0000-4000-8000-000000000001',
    'evt_invariant_001',
    'payment_intent.payment_failed',
    extensions.digest('different-payload', 'sha256')
  )$$,
  '23505',
  null,
  'conflicting provider event replay is rejected'
);

insert into public.bookings (
  id, reference, customer_id, booking_session_id, service_request_id,
  quote_id, payment_id, payment_status, dispatch_status
) values (
  '67000000-0000-4000-8000-000000000001',
  'RS-INVARIANT01',
  '60000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  '64000000-0000-4000-8000-000000000001',
  '65000000-0000-4000-8000-000000000001',
  '66000000-0000-4000-8000-000000000001',
  'succeeded',
  'ready'
);

insert into public.dispatch_notifications (
  booking_id, event_name, channel, recipient, idempotency_key
) values (
  '67000000-0000-4000-8000-000000000001',
  'booking.paid',
  'email',
  'dispatch@example.com',
  'dispatch-invariant-test-key'
);

select is(
  (public.enqueue_dispatch_notification(
    '67000000-0000-4000-8000-000000000001',
    'booking.paid',
    'email',
    'dispatch@example.com',
    'dispatch-invariant-test-key'
  )).id,
  (select id from public.dispatch_notifications where idempotency_key = 'dispatch-invariant-test-key'),
  'matching dispatch retry returns the original notification'
);

select throws_ok(
  $$insert into public.dispatch_notifications (
    booking_id, event_name, channel, recipient, idempotency_key
  ) values (
    '67000000-0000-4000-8000-000000000001',
    'booking.paid',
    'email',
    'dispatch@example.com',
    'dispatch-invariant-test-key'
  )$$,
  '23505',
  null,
  'dispatch idempotency keys are unique'
);

select throws_ok(
  $$insert into public.payment_refunds (
    payment_id, idempotency_key, amount_cents, status
  ) values (
    '66000000-0000-4000-8000-000000000001',
    'refund-over-payment-key',
    14000,
    'succeeded'
  )$$,
  '23514',
  null,
  'successful refunds cannot exceed payment amount'
);

select ok(
  (select count(*) > 0 from public.audit_logs where entity_table = 'payments'),
  'payment changes create audit records'
);

select is(
  (select refunded_amount_cents from public.payments where id = '66000000-0000-4000-8000-000000000001'),
  0,
  'failed excessive refund does not alter refunded amount'
);

select * from finish();
rollback;
