begin;

create extension if not exists pgcrypto with schema extensions;

create type public.admin_role as enum (
  'super_admin',
  'operations_admin',
  'dispatcher',
  'finance',
  'support'
);

create type public.request_type as enum ('roadside', 'towing');
create type public.location_kind as enum ('pickup', 'dropoff');
create type public.service_type as enum (
  'tow',
  'jump_start',
  'tire_change',
  'lockout',
  'fuel_delivery',
  'winch_out',
  'other'
);
create type public.quote_status as enum (
  'draft',
  'offered',
  'accepted',
  'expired',
  'superseded',
  'cancelled'
);
create type public.payment_status as enum (
  'pending',
  'processing',
  'requires_action',
  'succeeded',
  'failed',
  'partially_refunded',
  'refunded',
  'cancelled'
);
create type public.refund_status as enum (
  'pending',
  'succeeded',
  'failed',
  'cancelled'
);
create type public.dispatch_status as enum (
  'not_ready',
  'ready',
  'notified',
  'acknowledged',
  'assigned',
  'completed',
  'cancelled'
);
create type public.callback_status as enum (
  'new',
  'queued',
  'contacted',
  'resolved',
  'closed'
);
create type public.delivery_status as enum (
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead_letter'
);
create type public.notification_channel as enum ('email', 'sms', 'webhook');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_valid_iana_timezone(timezone_name text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select timezone_name = 'UTC'
    or (
      timezone_name ~ '^[A-Za-z_+-]+/[A-Za-z0-9_+-]+(?:/[A-Za-z0-9_+-]+)?$'
      and exists (
        select 1
        from pg_catalog.pg_timezone_names
        where name = timezone_name
      )
    );
$$;

create or replace function public.generate_booking_reference()
returns text
language sql
volatile
set search_path = ''
as $$
  select 'RS-' || upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 10));
$$;

comment on function public.generate_booking_reference() is
  'Generates a human-readable reference. The bookings unique constraint handles the remote possibility of collision.';

commit;
