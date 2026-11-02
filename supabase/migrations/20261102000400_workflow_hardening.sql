begin;

create or replace function public.validate_service_request_locations()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  pickup_kind public.location_kind;
  dropoff_kind public.location_kind;
begin
  select kind into pickup_kind
  from public.locations where id = new.pickup_location_id;

  if new.dropoff_location_id is not null then
    select kind into dropoff_kind
    from public.locations where id = new.dropoff_location_id;
  end if;

  if pickup_kind <> 'pickup'
    or (new.dropoff_location_id is not null and dropoff_kind <> 'dropoff')
  then
    raise exception 'Service request locations must use their declared pickup/dropoff kinds'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_route_relationships()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  request_pickup_id uuid;
  request_dropoff_id uuid;
begin
  select pickup_location_id, dropoff_location_id
  into request_pickup_id, request_dropoff_id
  from public.service_requests
  where id = new.service_request_id;

  if request_dropoff_id is null
    or new.pickup_location_id is distinct from request_pickup_id
    or new.dropoff_location_id is distinct from request_dropoff_id
  then
    raise exception 'Route locations must match the service request locations'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_quote_relationships()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  route_session_id uuid;
  route_request_id uuid;
begin
  if new.route_calculation_id is null then
    return new;
  end if;

  select booking_session_id, service_request_id
  into route_session_id, route_request_id
  from public.route_calculations
  where id = new.route_calculation_id;

  if route_session_id is distinct from new.booking_session_id
    or route_request_id is distinct from new.service_request_id
  then
    raise exception 'Quote route must belong to the same session and service request'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_quote_lifecycle()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'Quotes must be assembled in draft status' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    if not (
      (old.status = 'draft' and new.status in ('draft', 'offered', 'cancelled'))
      or (old.status = 'offered' and new.status in ('offered', 'accepted', 'expired', 'superseded', 'cancelled'))
      or (old.status = new.status and old.status in ('accepted', 'expired', 'superseded', 'cancelled'))
    ) then
      raise exception 'Invalid quote status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;

    if old.status = 'accepted' and new.accepted_at is distinct from old.accepted_at then
      raise exception 'Quote acceptance timestamp is immutable' using errcode = '23000';
    end if;
  end if;

  if new.status = 'accepted' and (
    new.accepted_at is null
    or new.accepted_at > now() + interval '5 minutes'
    or new.accepted_at > new.valid_until
    or now() > new.valid_until
  ) then
    raise exception 'An expired quote cannot be accepted' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.validate_quote_line_item_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  quote_status public.quote_status;
begin
  select status into quote_status from public.quotes where id = new.quote_id for share;

  if quote_status <> 'draft' then
    raise exception 'Line items can only be added while a quote is in draft status'
      using errcode = '23000';
  end if;

  return new;
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
  quote_state public.quote_status;
  quote_valid_until timestamptz;
begin
  select total_cents, currency, status, valid_until
  into quote_total, quote_currency, quote_state, quote_valid_until
  from public.quotes
  where id = new.quote_id
  for share;

  if quote_total is null then
    raise exception 'Payment quote does not exist' using errcode = '23503';
  end if;

  if quote_state <> 'accepted' or quote_valid_until < now() then
    raise exception 'Payments require an accepted, unexpired quote'
      using errcode = '23514';
  end if;

  if new.amount_cents <> quote_total or new.currency <> quote_currency then
    raise exception 'Payment amount and currency must match the immutable quote'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.protect_payment_identity_and_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.quote_id is distinct from old.quote_id
    or new.provider is distinct from old.provider
    or new.idempotency_key is distinct from old.idempotency_key
    or new.request_fingerprint is distinct from old.request_fingerprint
    or new.amount_cents is distinct from old.amount_cents
    or new.currency is distinct from old.currency
    or new.created_at is distinct from old.created_at
    or (old.provider_payment_id is not null and new.provider_payment_id is distinct from old.provider_payment_id)
    or (old.provider_checkout_session_id is not null and new.provider_checkout_session_id is distinct from old.provider_checkout_session_id)
  then
    raise exception 'Payment request identity is immutable' using errcode = '23000';
  end if;

  if new.status is distinct from old.status and not (
    (old.status = 'pending' and new.status in ('processing', 'requires_action', 'succeeded', 'failed', 'cancelled'))
    or (old.status = 'processing' and new.status in ('requires_action', 'succeeded', 'failed', 'cancelled'))
    or (old.status = 'requires_action' and new.status in ('processing', 'succeeded', 'failed', 'cancelled'))
    or (old.status = 'succeeded' and new.status in ('partially_refunded', 'refunded'))
    or (old.status = 'partially_refunded' and new.status in ('succeeded', 'refunded'))
    or (old.status = 'refunded' and new.status in ('succeeded', 'partially_refunded'))
  ) then
    raise exception 'Invalid payment status transition from % to %', old.status, new.status
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
  current_payment_status public.payment_status;
  successful_refunds bigint;
begin
  if tg_op = 'UPDATE' and new.payment_id is distinct from old.payment_id then
    raise exception 'A refund cannot be moved to another payment' using errcode = '23000';
  end if;

  select amount_cents, status
  into payment_amount, current_payment_status
  from public.payments
  where id = new.payment_id
  for update;

  if current_payment_status not in ('succeeded', 'partially_refunded', 'refunded') then
    raise exception 'Only a succeeded payment can be refunded' using errcode = '23514';
  end if;

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

  select amount_cents into payment_amount
  from public.payments where id = target_payment_id
  for update;

  select coalesce(sum(amount_cents), 0)::integer
  into total_refunded
  from public.payment_refunds
  where payment_id = target_payment_id
    and status = 'succeeded';

  update public.payments
  set refunded_amount_cents = total_refunded,
      status = case
        when total_refunded = 0 then 'succeeded'::public.payment_status
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
        when new.status <> 'succeeded' and dispatch_status = 'ready'
          then 'not_ready'::public.dispatch_status
        else dispatch_status
      end,
      updated_at = now()
  where payment_id = new.id
    and payment_status is distinct from new.status;

  return new;
end;
$$;

create or replace function public.protect_provider_event_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_id is distinct from old.payment_id
    or new.provider is distinct from old.provider
    or new.provider_event_id is distinct from old.provider_event_id
    or new.event_type is distinct from old.event_type
    or new.payload_hash is distinct from old.payload_hash
    or new.received_at is distinct from old.received_at
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Provider event identity is immutable' using errcode = '23000';
  end if;

  return new;
end;
$$;

create or replace function public.protect_dispatch_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.booking_id is distinct from old.booking_id
    or new.event_name is distinct from old.event_name
    or new.channel is distinct from old.channel
    or new.recipient is distinct from old.recipient
    or new.idempotency_key is distinct from old.idempotency_key
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Dispatch notification identity is immutable' using errcode = '23000';
  end if;

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
  application_role text;
begin
  old_record := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_record := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  target_id := coalesce(
    (new_record ->> 'id')::uuid,
    (old_record ->> 'id')::uuid,
    (new_record ->> 'user_id')::uuid,
    (old_record ->> 'user_id')::uuid
  );

  select role::text into application_role
  from public.admin_profiles
  where user_id = (select auth.uid());

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
    coalesce(application_role, (select auth.jwt() ->> 'role'), session_user),
    lower(tg_op),
    tg_table_name,
    target_id,
    old_record,
    new_record
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.create_payment_attempt(
  target_quote_id uuid,
  request_key text,
  fingerprint bytea
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_payment public.payments%rowtype;
  target_quote public.quotes%rowtype;
begin
  if char_length(request_key) < 16 or fingerprint is null then
    raise exception 'A valid idempotency key and fingerprint are required'
      using errcode = '22023';
  end if;

  select * into existing_payment
  from public.payments
  where idempotency_key = request_key;

  if found then
    if existing_payment.quote_id is distinct from target_quote_id
      or existing_payment.request_fingerprint is distinct from fingerprint
    then
      raise exception 'Idempotency key was reused with a different request'
        using errcode = '23505';
    end if;
    return existing_payment;
  end if;

  select * into target_quote
  from public.quotes
  where id = target_quote_id
  for update;

  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;

  insert into public.payments (
    quote_id,
    idempotency_key,
    request_fingerprint,
    amount_cents,
    currency
  ) values (
    target_quote.id,
    request_key,
    fingerprint,
    target_quote.total_cents,
    target_quote.currency
  )
  returning * into existing_payment;

  return existing_payment;
end;
$$;

create or replace function public.record_payment_provider_event(
  target_payment_id uuid,
  target_provider_event_id text,
  target_event_type text,
  target_payload_hash bytea
)
returns public.payment_provider_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.payment_provider_events%rowtype;
begin
  select * into existing_event
  from public.payment_provider_events
  where provider_event_id = target_provider_event_id;

  if found then
    if existing_event.payment_id is distinct from target_payment_id
      or existing_event.event_type is distinct from target_event_type
      or existing_event.payload_hash is distinct from target_payload_hash
    then
      raise exception 'Provider event ID was reused with different content'
        using errcode = '23505';
    end if;
    return existing_event;
  end if;

  insert into public.payment_provider_events (
    payment_id,
    provider_event_id,
    event_type,
    payload_hash
  ) values (
    target_payment_id,
    target_provider_event_id,
    target_event_type,
    target_payload_hash
  ) returning * into existing_event;

  return existing_event;
end;
$$;

create or replace function public.enqueue_dispatch_notification(
  target_booking_id uuid,
  target_event_name text,
  target_channel public.notification_channel,
  target_recipient text,
  request_key text
)
returns public.dispatch_notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_notification public.dispatch_notifications%rowtype;
begin
  select * into existing_notification
  from public.dispatch_notifications
  where idempotency_key = request_key
     or (
       booking_id = target_booking_id
       and event_name = target_event_name
       and channel = target_channel
       and recipient = target_recipient
     )
  limit 1;

  if found then
    if existing_notification.booking_id is distinct from target_booking_id
      or existing_notification.event_name is distinct from target_event_name
      or existing_notification.channel is distinct from target_channel
      or existing_notification.recipient is distinct from target_recipient
      or existing_notification.idempotency_key is distinct from request_key
    then
      raise exception 'Dispatch idempotency key or event identity conflicts with an existing request'
        using errcode = '23505';
    end if;
    return existing_notification;
  end if;

  insert into public.dispatch_notifications (
    booking_id,
    event_name,
    channel,
    recipient,
    idempotency_key
  ) values (
    target_booking_id,
    target_event_name,
    target_channel,
    target_recipient,
    request_key
  ) returning * into existing_notification;

  return existing_notification;
end;
$$;

revoke all on function public.create_payment_attempt(uuid, text, bytea) from public, anon, authenticated;
revoke all on function public.record_payment_provider_event(uuid, text, text, bytea) from public, anon, authenticated;
revoke all on function public.enqueue_dispatch_notification(uuid, text, public.notification_channel, text, text) from public, anon, authenticated;
grant execute on function public.create_payment_attempt(uuid, text, bytea) to service_role;
grant execute on function public.record_payment_provider_event(uuid, text, text, bytea) to service_role;
grant execute on function public.enqueue_dispatch_notification(uuid, text, public.notification_channel, text, text) to service_role;

create trigger service_requests_validate_locations
  before insert or update of pickup_location_id, dropoff_location_id on public.service_requests
  for each row execute function public.validate_service_request_locations();
create trigger route_calculations_validate_relationships
  before insert on public.route_calculations
  for each row execute function public.validate_route_relationships();
create trigger quotes_validate_relationships
  before insert or update of route_calculation_id on public.quotes
  for each row execute function public.validate_quote_relationships();
create trigger quotes_validate_lifecycle
  before insert or update of status, accepted_at on public.quotes
  for each row execute function public.validate_quote_lifecycle();
create trigger quotes_prevent_delete
  before delete on public.quotes
  for each row execute function public.prevent_row_mutation();
create trigger quote_line_items_validate_insert
  before insert on public.quote_line_items
  for each row execute function public.validate_quote_line_item_insert();
create trigger payments_protect_identity_and_status
  before update on public.payments
  for each row execute function public.protect_payment_identity_and_status();
create trigger payment_provider_events_protect_identity
  before update on public.payment_provider_events
  for each row execute function public.protect_provider_event_identity();
create trigger payment_provider_events_prevent_delete
  before delete on public.payment_provider_events
  for each row execute function public.prevent_row_mutation();
create trigger dispatch_notifications_protect_identity
  before update on public.dispatch_notifications
  for each row execute function public.protect_dispatch_identity();
create trigger audit_payment_provider_events
  after insert or update on public.payment_provider_events
  for each row execute function public.write_audit_log();

alter table public.payment_provider_events enable row level security;
alter table public.payment_provider_events force row level security;
revoke all on table public.payment_provider_events from anon, authenticated;
grant select on table public.payment_provider_events to authenticated;

-- Replace broad Unit 2 policies with operation- and role-specific policies.
drop policy "staff manage customers" on public.customers;
drop policy "staff manage sessions" on public.booking_sessions;
drop policy "staff manage vehicles" on public.vehicles;
drop policy "staff manage locations" on public.locations;
drop policy "staff manage service requests" on public.service_requests;
drop policy "staff manage bookings" on public.bookings;
drop policy "staff manage handoff leads" on public.handoff_leads;
drop policy "staff manage dispatch notifications" on public.dispatch_notifications;
drop policy "staff read own admin profile" on public.admin_profiles;
drop policy "super admins manage admin profiles" on public.admin_profiles;
drop policy "pricing administrators read pricing" on public.pricing_parameters;
drop policy "pricing administrators manage pricing" on public.pricing_parameters;
drop policy "authorized staff read payments" on public.payments;
drop policy "authorized staff read refunds" on public.payment_refunds;
drop policy "authorized staff read audit logs" on public.audit_logs;
drop policy "authorized staff read application settings" on public.application_settings;
drop policy "operations administrators manage application settings" on public.application_settings;

create policy "staff read customers" on public.customers
  for select to authenticated using (public.is_admin());
create policy "operations manage customers" on public.customers
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "staff read sessions" on public.booking_sessions
  for select to authenticated using (public.is_admin());
create policy "operations manage sessions" on public.booking_sessions
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "staff read vehicles" on public.vehicles
  for select to authenticated using (public.is_admin());
create policy "operations manage vehicles" on public.vehicles
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "staff read locations" on public.locations
  for select to authenticated using (public.is_admin());
create policy "operations manage locations" on public.locations
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "staff read service requests" on public.service_requests
  for select to authenticated using (public.is_admin());
create policy "operations manage service requests" on public.service_requests
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "staff read bookings" on public.bookings
  for select to authenticated using (public.is_admin());
create policy "operations dispatch manage bookings" on public.bookings
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin', 'dispatcher']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin', 'dispatcher']::public.admin_role[]));

create policy "staff read handoff leads" on public.handoff_leads
  for select to authenticated using (public.is_admin());
create policy "support manage handoff leads" on public.handoff_leads
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin', 'support']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin', 'support']::public.admin_role[]));

create policy "staff read dispatch notifications" on public.dispatch_notifications
  for select to authenticated using (public.is_admin());
create policy "dispatch manage notifications" on public.dispatch_notifications
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin', 'dispatcher']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin', 'dispatcher']::public.admin_role[]));

create policy "administrators read own profile" on public.admin_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "super admins manage profiles" on public.admin_profiles
  for all to authenticated
  using (public.is_admin(array['super_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin']::public.admin_role[]));

create policy "staff read pricing" on public.pricing_parameters
  for select to authenticated using (public.is_admin());
create policy "operations manage pricing" on public.pricing_parameters
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "finance operations read payments" on public.payments
  for select to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin', 'finance']::public.admin_role[]));
create policy "finance operations read refunds" on public.payment_refunds
  for select to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin', 'finance']::public.admin_role[]));
create policy "finance operations read provider events" on public.payment_provider_events
  for select to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin', 'finance']::public.admin_role[]));
create policy "security administrators read audit logs" on public.audit_logs
  for select to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

create policy "staff read application settings" on public.application_settings
  for select to authenticated using (public.is_admin());
create policy "operations manage application settings" on public.application_settings
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));

comment on table public.payment_provider_events is
  'Append-only provider event ledger. Unique provider_event_id prevents webhook replay processing.';
comment on function public.create_payment_attempt(uuid, text, bytea) is
  'Service-role-only atomic payment idempotency boundary. Matching retries return the original payment.';
comment on function public.enqueue_dispatch_notification(uuid, text, public.notification_channel, text, text) is
  'Service-role-only dispatch enqueue boundary. Matching retries return the original notification.';

commit;
