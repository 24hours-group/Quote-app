begin;

create extension if not exists pgtap with schema extensions;
select plan(23);

select has_function(
  'public',
  'attach_unverified_customer_to_session',
  array['bytea', 'bigint', 'text', 'text', 'text', 'boolean'],
  'contact attachment RPC exists'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.attach_unverified_customer_to_session(bytea,bigint,text,text,text,boolean)',
    'EXECUTE'
  ),
  'anonymous users cannot attach booking contacts'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.attach_unverified_customer_to_session(bytea,bigint,text,text,text,boolean)',
    'EXECUTE'
  ),
  'authenticated users cannot bypass the server contact API'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.attach_unverified_customer_to_session(bytea,bigint,text,text,text,boolean)',
    'EXECUTE'
  ),
  'service role can attach a session-authorized contact'
);
select ok(
  not has_function_privilege(
    'service_role',
    'public.start_booking_phone_verification(bytea,bigint,text,text,text,timestamptz,timestamptz)',
    'EXECUTE'
  ),
  'retired OTP start RPC is unavailable to the application service role'
);

select is(
  public.normalize_us_phone_e164('(212) 555-0100'),
  '+12125550100',
  'US numbers normalize to E.164'
);
select throws_ok(
  $$ select public.normalize_us_phone_e164('+44 20 7946 0958') $$,
  '22023',
  null,
  'non-US numbers are rejected'
);

insert into public.customers (
  id, full_name, receipt_email, phone_e164, phone_verified_at,
  sms_consent, sms_consent_at
) values (
  '73000000-0000-4000-8000-000000000001',
  'Existing Verified Customer',
  'existing@example.com',
  '+12125550100',
  now(),
  false,
  null
);

insert into public.booking_sessions (
  id, access_token_hash, current_screen, expires_at
) values
  (
    '73000000-0000-4000-8000-000000000010',
    extensions.digest('contact-session-one', 'sha256'),
    'S2',
    now() + interval '1 hour'
  ),
  (
    '73000000-0000-4000-8000-000000000020',
    extensions.digest('contact-session-two', 'sha256'),
    'S2',
    now() + interval '1 hour'
  );

select isnt(
  (
    select customer_id
    from public.attach_unverified_customer_to_session(
      extensions.digest('contact-session-one', 'sha256'),
      0,
      'Maria Santos',
      'MARIA@EXAMPLE.COM',
      '(212) 555-0100',
      false
    )
  ),
  null::uuid,
  'a valid contact is attached to its active session'
);
select is(
  (select version from public.booking_sessions where id = '73000000-0000-4000-8000-000000000010'),
  1::bigint,
  'contact attachment increments the session version'
);
select is(
  (
    select customer.phone_verified_at
    from public.customers customer
    join public.booking_sessions session on session.customer_id = customer.id
    where session.id = '73000000-0000-4000-8000-000000000010'
  ),
  null::timestamptz,
  'format validation does not mark ownership as verified'
);
select is(
  (
    select customer.sms_consent
    from public.customers customer
    join public.booking_sessions session on session.customer_id = customer.id
    where session.id = '73000000-0000-4000-8000-000000000010'
  ),
  false,
  'SMS consent remains disabled'
);
select is(
  (
    select customer.receipt_email
    from public.customers customer
    join public.booking_sessions session on session.customer_id = customer.id
    where session.id = '73000000-0000-4000-8000-000000000010'
  ),
  'maria@example.com',
  'receipt email is normalized'
);
select is(
  (select count(*) from public.customers where phone_e164 = '+12125550100'),
  2::bigint,
  'an anonymous contact does not merge into an existing verified customer'
);
select is(
  (select full_name from public.customers where id = '73000000-0000-4000-8000-000000000001'),
  'Existing Verified Customer',
  'existing verified customer data is not overwritten'
);

select isnt(
  (
    select customer_id
    from public.attach_unverified_customer_to_session(
      extensions.digest('contact-session-two', 'sha256'),
      0,
      'Jordan Smith',
      'jordan@example.com',
      '+1 212 555 0100',
      true
    )
  ),
  null::uuid,
  'a second session can independently submit the same unverified number'
);
select is(
  (select count(*) from public.customers where phone_e164 = '+12125550100'),
  3::bigint,
  'unverified contacts are isolated instead of globally unique'
);
select isnt(
  (select customer_id from public.booking_sessions where id = '73000000-0000-4000-8000-000000000010'),
  (select customer_id from public.booking_sessions where id = '73000000-0000-4000-8000-000000000020'),
  'sessions using the same submitted phone do not share a customer row'
);

select throws_ok(
  $$
    select public.attach_unverified_customer_to_session(
      extensions.digest('contact-session-one', 'sha256'),
      0,
      'Maria Santos',
      'maria@example.com',
      '+12125550100',
      false
    )
  $$,
  '40001',
  null,
  'stale session versions are rejected'
);
select throws_ok(
  $$
    select public.attach_unverified_customer_to_session(
      extensions.digest('unknown-contact-session', 'sha256'),
      0,
      'Maria Santos',
      'maria@example.com',
      '+12125550100',
      false
    )
  $$,
  'P0002',
  null,
  'a different session token cannot attach contact data'
);
select is(
  public.detach_booking_customer_from_session(
    extensions.digest('contact-session-one', 'sha256'),
    1
  ),
  2::bigint,
  'contact detachment uses optimistic concurrency'
);
select is(
  (select customer_id from public.booking_sessions where id = '73000000-0000-4000-8000-000000000010'),
  null::uuid,
  'detachment removes the session customer link'
);
select is(
  (select count(*) from public.customers where phone_e164 = '+12125550100'),
  2::bigint,
  'detachment deletes only the isolated unverified contact'
);
select is(
  (select count(*) from public.customers where id = '73000000-0000-4000-8000-000000000001'),
  1::bigint,
  'detachment preserves the existing verified customer'
);

select * from finish();
rollback;
