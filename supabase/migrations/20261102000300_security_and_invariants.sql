begin;

create or replace function public.is_admin(allowed_roles public.admin_role[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_profiles
    where user_id = (select auth.uid())
      and is_active
      and (allowed_roles is null or role = any(allowed_roles))
  );
$$;

revoke all on function public.is_admin(public.admin_role[]) from public;
grant execute on function public.is_admin(public.admin_role[]) to authenticated;

create or replace function public.prevent_row_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% records are immutable after insertion', tg_table_name
    using errcode = '23000';
end;
$$;

create or replace function public.protect_quote_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.booking_session_id is distinct from old.booking_session_id
    or new.service_request_id is distinct from old.service_request_id
    or new.route_calculation_id is distinct from old.route_calculation_id
    or new.subtotal_cents is distinct from old.subtotal_cents
    or new.tax_cents is distinct from old.tax_cents
    or new.total_cents is distinct from old.total_cents
    or new.currency is distinct from old.currency
    or new.pricing_version is distinct from old.pricing_version
    or new.pricing_snapshot is distinct from old.pricing_snapshot
    or new.valid_until is distinct from old.valid_until
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Quote pricing snapshots cannot be changed after generation'
      using errcode = '23000';
  end if;

  return new;
end;
$$;

create or replace function public.validate_quote_line_items()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  target_quote_id uuid;
  expected_subtotal integer;
  actual_subtotal bigint;
begin
  if tg_table_name = 'quotes' then
    target_quote_id := coalesce(new.id, old.id);
  else
    target_quote_id := coalesce(new.quote_id, old.quote_id);
  end if;

  select subtotal_cents
  into expected_subtotal
  from public.quotes
  where id = target_quote_id;

  if expected_subtotal is null then
    return null;
  end if;

  select coalesce(sum(total_amount_cents), 0)
  into actual_subtotal
  from public.quote_line_items
  where quote_id = target_quote_id;

  if actual_subtotal <> expected_subtotal then
    raise exception 'Quote line items (%) do not equal subtotal (%)', actual_subtotal, expected_subtotal
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create or replace function public.validate_payment_against_quote()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quote_total integer;
  quote_currency text;
begin
  select total_cents, currency
  into quote_total, quote_currency
  from public.quotes
  where id = new.quote_id
  for share;

  if quote_total is null then
    raise exception 'Payment quote does not exist' using errcode = '23503';
  end if;

  if new.amount_cents <> quote_total or new.currency <> quote_currency then
    raise exception 'Payment amount and currency must match the immutable quote'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_booking_relations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  session_customer_id uuid;
  request_session_id uuid;
  quote_session_id uuid;
  quote_request_id uuid;
  payment_quote_id uuid;
  linked_payment_status public.payment_status;
begin
  select customer_id into session_customer_id
  from public.booking_sessions where id = new.booking_session_id;

  select booking_session_id into request_session_id
  from public.service_requests where id = new.service_request_id;

  select booking_session_id, service_request_id
  into quote_session_id, quote_request_id
  from public.quotes where id = new.quote_id;

  if new.payment_id is not null then
    select quote_id, status into payment_quote_id, linked_payment_status
    from public.payments where id = new.payment_id;
  end if;

  if session_customer_id is distinct from new.customer_id
    or request_session_id is distinct from new.booking_session_id
    or quote_session_id is distinct from new.booking_session_id
    or quote_request_id is distinct from new.service_request_id
    or (new.payment_id is not null and payment_quote_id is distinct from new.quote_id)
    or (new.payment_id is not null and linked_payment_status is distinct from new.payment_status)
    or (new.payment_id is null and new.payment_status <> 'pending')
  then
    raise exception 'Booking relationships must belong to the same customer session and quote'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_refund_total()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  payment_amount integer;
  successful_refunds bigint;
begin
  if tg_op = 'UPDATE' and new.payment_id is distinct from old.payment_id then
    raise exception 'A refund cannot be moved to another payment' using errcode = '23000';
  end if;

  select amount_cents into payment_amount
  from public.payments
  where id = new.payment_id
  for update;

  select coalesce(sum(amount_cents), 0)
  into successful_refunds
  from public.payment_refunds
  where payment_id = new.payment_id
    and status = 'succeeded'
    and id <> new.id;

  if new.status = 'succeeded' then
    successful_refunds := successful_refunds + new.amount_cents;
  end if;

  if successful_refunds > payment_amount then
    raise exception 'Successful refunds cannot exceed the payment amount'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.reconcile_payment_refunds()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_payment_id uuid;
  total_refunded integer;
  payment_amount integer;
begin
  target_payment_id := coalesce(new.payment_id, old.payment_id);

  select coalesce(sum(amount_cents), 0)::integer
  into total_refunded
  from public.payment_refunds
  where payment_id = target_payment_id
    and status = 'succeeded';

  select amount_cents into payment_amount
  from public.payments where id = target_payment_id;

  update public.payments
  set refunded_amount_cents = total_refunded,
      status = case
        when total_refunded = 0 then status
        when total_refunded = payment_amount then 'refunded'::public.payment_status
        else 'partially_refunded'::public.payment_status
      end,
      updated_at = now()
  where id = target_payment_id;

  return null;
end;
$$;

create or replace function public.sync_booking_payment_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.bookings
  set payment_status = new.status,
      dispatch_status = case
        when new.status = 'succeeded' and dispatch_status = 'not_ready'
          then 'ready'::public.dispatch_status
        else dispatch_status
      end,
      updated_at = now()
  where payment_id = new.id
    and payment_status is distinct from new.status;

  return new;
end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_record jsonb;
  new_record jsonb;
  target_id uuid;
begin
  old_record := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_record := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  target_id := coalesce(
    (new_record ->> 'id')::uuid,
    (old_record ->> 'id')::uuid,
    (new_record ->> 'user_id')::uuid,
    (old_record ->> 'user_id')::uuid
  );

  insert into public.audit_logs (
    actor_user_id,
    actor_role,
    action,
    entity_table,
    entity_id,
    old_values,
    new_values
  ) values (
    (select auth.uid()),
    current_user,
    lower(tg_op),
    tg_table_name,
    target_id,
    old_record,
    new_record
  );

  return coalesce(new, old);
end;
$$;

create trigger admin_profiles_updated_at before update on public.admin_profiles
  for each row execute function public.set_updated_at();
create trigger customers_updated_at before update on public.customers
  for each row execute function public.set_updated_at();
create trigger booking_sessions_updated_at before update on public.booking_sessions
  for each row execute function public.set_updated_at();
create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_updated_at();
create trigger locations_updated_at before update on public.locations
  for each row execute function public.set_updated_at();
create trigger service_requests_updated_at before update on public.service_requests
  for each row execute function public.set_updated_at();
create trigger pricing_parameters_updated_at before update on public.pricing_parameters
  for each row execute function public.set_updated_at();
create trigger quotes_updated_at before update on public.quotes
  for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();
create trigger payment_refunds_updated_at before update on public.payment_refunds
  for each row execute function public.set_updated_at();
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();
create trigger handoff_leads_updated_at before update on public.handoff_leads
  for each row execute function public.set_updated_at();
create trigger dispatch_notifications_updated_at before update on public.dispatch_notifications
  for each row execute function public.set_updated_at();
create trigger application_settings_updated_at before update on public.application_settings
  for each row execute function public.set_updated_at();

create trigger route_calculations_immutable
  before update or delete on public.route_calculations
  for each row execute function public.prevent_row_mutation();
create trigger quote_line_items_immutable
  before update or delete on public.quote_line_items
  for each row execute function public.prevent_row_mutation();
create trigger quotes_snapshot_immutable
  before update on public.quotes
  for each row execute function public.protect_quote_snapshot();

create constraint trigger quote_subtotal_on_quote
  after insert or update on public.quotes
  deferrable initially deferred
  for each row execute function public.validate_quote_line_items();
create constraint trigger quote_subtotal_on_line_item
  after insert on public.quote_line_items
  deferrable initially deferred
  for each row execute function public.validate_quote_line_items();

create trigger payments_validate_quote
  before insert or update of quote_id, amount_cents, currency on public.payments
  for each row execute function public.validate_payment_against_quote();
create trigger bookings_validate_relations
  before insert or update of customer_id, booking_session_id, service_request_id, quote_id, payment_id
  on public.bookings
  for each row execute function public.validate_booking_relations();
create trigger payment_refunds_validate_total
  before insert or update of payment_id, amount_cents, status on public.payment_refunds
  for each row execute function public.validate_refund_total();
create trigger payment_refunds_reconcile_write
  after insert or update of amount_cents, status on public.payment_refunds
  for each row execute function public.reconcile_payment_refunds();
create trigger payment_refunds_reconcile_delete
  after delete on public.payment_refunds
  for each row execute function public.reconcile_payment_refunds();
create trigger payments_sync_booking
  after update of status on public.payments
  for each row execute function public.sync_booking_payment_status();

create trigger audit_admin_profiles after insert or update or delete on public.admin_profiles
  for each row execute function public.write_audit_log();
create trigger audit_pricing_parameters after insert or update or delete on public.pricing_parameters
  for each row execute function public.write_audit_log();
create trigger audit_payments after insert or update on public.payments
  for each row execute function public.write_audit_log();
create trigger audit_payment_refunds after insert or update on public.payment_refunds
  for each row execute function public.write_audit_log();
create trigger audit_bookings after insert or update on public.bookings
  for each row execute function public.write_audit_log();
create trigger audit_handoff_leads after insert or update on public.handoff_leads
  for each row execute function public.write_audit_log();
create trigger audit_dispatch_notifications after insert or update on public.dispatch_notifications
  for each row execute function public.write_audit_log();
create trigger audit_application_settings after insert or update on public.application_settings
  for each row execute function public.write_audit_log();

alter table public.admin_profiles enable row level security;
alter table public.customers enable row level security;
alter table public.booking_sessions enable row level security;
alter table public.vehicles enable row level security;
alter table public.locations enable row level security;
alter table public.service_requests enable row level security;
alter table public.route_calculations enable row level security;
alter table public.pricing_parameters enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_line_items enable row level security;
alter table public.payments enable row level security;
alter table public.payment_refunds enable row level security;
alter table public.bookings enable row level security;
alter table public.handoff_leads enable row level security;
alter table public.dispatch_notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.application_settings enable row level security;

alter table public.admin_profiles force row level security;
alter table public.customers force row level security;
alter table public.booking_sessions force row level security;
alter table public.vehicles force row level security;
alter table public.locations force row level security;
alter table public.service_requests force row level security;
alter table public.route_calculations force row level security;
alter table public.pricing_parameters force row level security;
alter table public.quotes force row level security;
alter table public.quote_line_items force row level security;
alter table public.payments force row level security;
alter table public.payment_refunds force row level security;
alter table public.bookings force row level security;
alter table public.handoff_leads force row level security;
alter table public.dispatch_notifications force row level security;
alter table public.audit_logs force row level security;
alter table public.application_settings force row level security;

revoke all on table public.admin_profiles from anon, authenticated;
revoke all on table public.customers from anon, authenticated;
revoke all on table public.booking_sessions from anon, authenticated;
revoke all on table public.vehicles from anon, authenticated;
revoke all on table public.locations from anon, authenticated;
revoke all on table public.service_requests from anon, authenticated;
revoke all on table public.route_calculations from anon, authenticated;
revoke all on table public.pricing_parameters from anon, authenticated;
revoke all on table public.quotes from anon, authenticated;
revoke all on table public.quote_line_items from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.payment_refunds from anon, authenticated;
revoke all on table public.bookings from anon, authenticated;
revoke all on table public.handoff_leads from anon, authenticated;
revoke all on table public.dispatch_notifications from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
revoke all on table public.application_settings from anon, authenticated;

create policy "staff manage customers" on public.customers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff manage sessions" on public.booking_sessions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff manage vehicles" on public.vehicles
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff manage locations" on public.locations
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff manage service requests" on public.service_requests
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff read route calculations" on public.route_calculations
  for select to authenticated using (public.is_admin());
create policy "staff read quotes" on public.quotes
  for select to authenticated using (public.is_admin());
create policy "staff read quote line items" on public.quote_line_items
  for select to authenticated using (public.is_admin());
create policy "staff manage bookings" on public.bookings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff manage handoff leads" on public.handoff_leads
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "staff manage dispatch notifications" on public.dispatch_notifications
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "staff read own admin profile" on public.admin_profiles
  for select to authenticated using (public.is_admin());
create policy "super admins manage admin profiles" on public.admin_profiles
  for all to authenticated
  using (public.is_admin(array['super_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin']::public.admin_role[]));

create policy "pricing administrators read pricing" on public.pricing_parameters
  for select to authenticated using (public.is_admin());
create policy "pricing administrators manage pricing" on public.pricing_parameters
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "authorized staff read payments" on public.payments
  for select to authenticated using (public.is_admin());
create policy "authorized staff read refunds" on public.payment_refunds
  for select to authenticated using (public.is_admin());
create policy "authorized staff read audit logs" on public.audit_logs
  for select to authenticated using (public.is_admin());

create policy "authorized staff read application settings" on public.application_settings
  for select to authenticated using (public.is_admin());
create policy "operations administrators manage application settings" on public.application_settings
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.customers to authenticated;
grant select, insert, update, delete on table public.booking_sessions to authenticated;
grant select, insert, update, delete on table public.vehicles to authenticated;
grant select, insert, update, delete on table public.locations to authenticated;
grant select, insert, update, delete on table public.service_requests to authenticated;
grant select on table public.route_calculations to authenticated;
grant select on table public.quotes to authenticated;
grant select on table public.quote_line_items to authenticated;
grant select, insert, update, delete on table public.bookings to authenticated;
grant select, insert, update, delete on table public.handoff_leads to authenticated;
grant select, insert, update, delete on table public.dispatch_notifications to authenticated;
grant select, insert, update, delete on table public.admin_profiles to authenticated;
grant select, insert, update, delete on table public.pricing_parameters to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.payment_refunds to authenticated;
grant select on table public.audit_logs to authenticated;
grant select, insert, update, delete on table public.application_settings to authenticated;

comment on table public.booking_sessions is
  'Guest sessions are accessed only by trusted server code using a SHA-256 token hash. No anon or customer RLS policy exists.';
comment on column public.booking_sessions.access_token_hash is
  'SHA-256 hash of an opaque 256-bit session token. Never store or log the raw token.';
comment on table public.payments is
  'Stores provider references and integer monetary amounts only. Payment card details must never be stored.';
comment on column public.payments.request_fingerprint is
  'Hash of the canonical payment request used with idempotency_key to detect conflicting retries.';
comment on column public.quotes.pricing_snapshot is
  'Immutable pricing parameter snapshot used to reproduce the quote after pricing changes.';
comment on column public.dispatch_notifications.idempotency_key is
  'Stable key per booking event and recipient; retries reuse this key.';

commit;
