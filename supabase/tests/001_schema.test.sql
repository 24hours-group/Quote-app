begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

select has_table('public', 'customers', 'customers table exists');
select has_table('public', 'booking_sessions', 'booking_sessions table exists');
select has_table('public', 'vehicles', 'vehicles table exists');
select has_table('public', 'locations', 'locations table exists');
select has_table('public', 'service_requests', 'service_requests table exists');
select has_table('public', 'route_calculations', 'route_calculations table exists');
select has_table('public', 'pricing_parameters', 'pricing_parameters table exists');
select has_table('public', 'quotes', 'quotes table exists');
select has_table('public', 'quote_line_items', 'quote_line_items table exists');
select has_table('public', 'payments', 'payments table exists');
select has_table('public', 'payment_provider_events', 'payment_provider_events table exists');
select has_table('public', 'payment_refunds', 'payment_refunds table exists');
select has_table('public', 'bookings', 'bookings table exists');
select has_table('public', 'handoff_leads', 'handoff_leads table exists');
select has_table('public', 'dispatch_notifications', 'dispatch_notifications table exists');
select has_table('public', 'audit_logs', 'audit_logs table exists');
select has_table('public', 'admin_profiles', 'admin_profiles table exists');
select has_table('public', 'application_settings', 'application_settings table exists');

select has_pk('public', 'customers', 'customers has a primary key');
select has_pk('public', 'quotes', 'quotes has a primary key');
select has_pk('public', 'payments', 'payments has a primary key');
select has_pk('public', 'bookings', 'bookings has a primary key');

select col_type_is('public', 'quotes', 'total_cents', 'integer', 'quote totals use integer cents');
select col_type_is('public', 'payments', 'amount_cents', 'integer', 'payment amounts use integer cents');

select ok(
  not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name in ('payments', 'payment_refunds')
      and column_name ~* '(card|pan|cvv|cvc|expiry)'
  ),
  'payment tables contain no card-detail columns'
);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.customers'::regclass),
  'customers has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.booking_sessions'::regclass),
  'booking_sessions has RLS enabled'
);
select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.bookings'::regclass),
  'bookings has RLS enabled'
);
select is(
  (
    select count(*)
    from pg_catalog.pg_class
    where oid = any(array[
      'public.admin_profiles'::regclass,
      'public.customers'::regclass,
      'public.booking_sessions'::regclass,
      'public.vehicles'::regclass,
      'public.locations'::regclass,
      'public.service_requests'::regclass,
      'public.route_calculations'::regclass,
      'public.pricing_parameters'::regclass,
      'public.quotes'::regclass,
      'public.quote_line_items'::regclass,
      'public.payments'::regclass,
      'public.payment_provider_events'::regclass,
      'public.payment_refunds'::regclass,
      'public.bookings'::regclass,
      'public.handoff_leads'::regclass,
      'public.dispatch_notifications'::regclass,
      'public.audit_logs'::regclass,
      'public.application_settings'::regclass
    ]) and relrowsecurity
  ),
  18::bigint,
  'every application table has RLS enabled'
);

select * from finish();
rollback;
