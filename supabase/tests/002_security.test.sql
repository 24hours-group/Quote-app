begin;

create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'admin-test@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'customer-test@example.com',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.admin_profiles (user_id, role, display_name)
values ('30000000-0000-4000-8000-000000000001', 'super_admin', 'Security Test Admin');

insert into public.customers (
  id,
  auth_user_id,
  full_name,
  phone_e164,
  phone_verified_at
) values (
  '40000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000002',
  'Security Test Customer',
  '+15550102021',
  now()
);

insert into public.booking_sessions (
  id,
  customer_id,
  access_token_hash,
  expires_at
) values (
  '50000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001',
  extensions.digest('test-session-token', 'sha256'),
  now() + interval '1 hour'
);

set local role anon;
select throws_ok(
  'select * from public.customers',
  '42501',
  null,
  'anonymous users cannot select customers'
);
select throws_ok(
  'select * from public.bookings',
  '42501',
  null,
  'anonymous users cannot select bookings'
);
select throws_ok(
  'select * from public.booking_sessions',
  '42501',
  null,
  'anonymous users cannot select booking sessions'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and ('anon' = any(roles) or 'public' = any(roles))
  ),
  0::bigint,
  'no application policy grants anonymous table access'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);
select is((select count(*) from public.customers), 0::bigint, 'customers cannot directly read their customer row');
select is((select count(*) from public.booking_sessions), 0::bigint, 'customers cannot directly read booking sessions');
select is((select count(*) from public.bookings), 0::bigint, 'customers cannot directly enumerate bookings');
select throws_ok(
  $$insert into public.payments (
    quote_id, idempotency_key, request_fingerprint, amount_cents, currency
  ) values (
    '00000000-0000-4000-8000-000000000000', repeat('x', 16), '\\x01', 100, 'USD'
  )$$,
  '42501',
  null,
  'customers cannot write payment records'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"30000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);
select ok(public.is_admin(), 'active administrator is recognized');
select is((select count(*) from public.customers), 1::bigint, 'administrator can read customers');
select is((select count(*) from public.booking_sessions), 1::bigint, 'administrator can read booking sessions');

select * from finish();
rollback;
