begin;

create or replace function public.validate_booking_state()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  linked_payment_status public.payment_status;
begin
  if new.payment_id is null then
    if new.payment_status <> 'pending' then
      raise exception 'A booking without a payment must remain pending'
        using errcode = '23514';
    end if;
  else
    select status into linked_payment_status
    from public.payments where id = new.payment_id;

    if new.payment_status is distinct from linked_payment_status then
      raise exception 'Booking payment status must match its linked payment'
        using errcode = '23514';
    end if;
  end if;

  if new.dispatch_status = 'ready' and new.payment_status <> 'succeeded' then
    raise exception 'A booking cannot be dispatch-ready without succeeded payment'
      using errcode = '23514';
  end if;

  if tg_op = 'UPDATE'
    and public.is_admin(array['dispatcher']::public.admin_role[])
    and not public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[])
    and (
      new.reference is distinct from old.reference
      or new.customer_id is distinct from old.customer_id
      or new.booking_session_id is distinct from old.booking_session_id
      or new.service_request_id is distinct from old.service_request_id
      or new.quote_id is distinct from old.quote_id
      or new.payment_id is distinct from old.payment_id
      or new.payment_status is distinct from old.payment_status
      or new.booked_at is distinct from old.booked_at
      or new.completed_at is distinct from old.completed_at
      or new.cancelled_at is distinct from old.cancelled_at
      or new.created_at is distinct from old.created_at
    )
  then
    raise exception 'Dispatchers may update dispatch status only'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.protect_priced_service_request()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    exists (select 1 from public.quotes where service_request_id = old.id)
    or exists (select 1 from public.route_calculations where service_request_id = old.id)
  ) and (
    new.booking_session_id is distinct from old.booking_session_id
    or new.vehicle_id is distinct from old.vehicle_id
    or new.pickup_location_id is distinct from old.pickup_location_id
    or new.dropoff_location_id is distinct from old.dropoff_location_id
    or new.service_type is distinct from old.service_type
    or new.structured_answers is distinct from old.structured_answers
    or new.customer_notes is distinct from old.customer_notes
    or new.special_flags is distinct from old.special_flags
  ) then
    raise exception 'A service request cannot change after routing or quoting'
      using errcode = '23000';
  end if;

  return new;
end;
$$;

create or replace function public.protect_routed_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.route_calculations
    where pickup_location_id = old.id or dropoff_location_id = old.id
  ) and (
    new.booking_session_id is distinct from old.booking_session_id
    or new.kind is distinct from old.kind
    or new.formatted_address is distinct from old.formatted_address
    or new.google_place_id is distinct from old.google_place_id
    or new.latitude is distinct from old.latitude
    or new.longitude is distinct from old.longitude
    or new.timezone is distinct from old.timezone
    or new.is_confirmed is distinct from old.is_confirmed
    or new.confirmed_at is distinct from old.confirmed_at
  ) then
    raise exception 'A routed location cannot change after route calculation'
      using errcode = '23000';
  end if;

  return new;
end;
$$;

create or replace function public.protect_refund_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.payment_id is distinct from old.payment_id
    or new.idempotency_key is distinct from old.idempotency_key
    or new.amount_cents is distinct from old.amount_cents
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Refund request identity is immutable' using errcode = '23000';
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

  begin
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
  exception when unique_violation then
    select * into existing_payment
    from public.payments
    where idempotency_key = request_key;

    if not found then
      raise;
    end if;
  end;

  if existing_payment.quote_id is distinct from target_quote_id
    or existing_payment.request_fingerprint is distinct from fingerprint
  then
    raise exception 'Idempotency key was reused with a different request'
      using errcode = '23505';
  end if;

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
  if target_payment_id is null then
    raise exception 'A payment is required for provider events' using errcode = '22023';
  end if;

  begin
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
    )
    on conflict (provider_event_id) do nothing
    returning * into existing_event;
  exception when unique_violation then
    null;
  end;

  if existing_event.id is null then
    select * into existing_event
    from public.payment_provider_events
    where provider_event_id = target_provider_event_id;
  end if;

  if existing_event.payment_id is distinct from target_payment_id
    or existing_event.event_type is distinct from target_event_type
    or existing_event.payload_hash is distinct from target_payload_hash
  then
    raise exception 'Provider event ID was reused with different content'
      using errcode = '23505';
  end if;

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
  begin
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
  exception when unique_violation then
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
  end;

  if existing_notification.id is null
    or existing_notification.booking_id is distinct from target_booking_id
    or existing_notification.event_name is distinct from target_event_name
    or existing_notification.channel is distinct from target_channel
    or existing_notification.recipient is distinct from target_recipient
    or existing_notification.idempotency_key is distinct from request_key
  then
    raise exception 'Dispatch idempotency key or event identity conflicts with an existing request'
      using errcode = '23505';
  end if;

  return existing_notification;
end;
$$;

create trigger bookings_validate_state
  before insert or update on public.bookings
  for each row execute function public.validate_booking_state();
create trigger service_requests_protect_priced_input
  before update on public.service_requests
  for each row execute function public.protect_priced_service_request();
create trigger locations_protect_routed_input
  before update on public.locations
  for each row execute function public.protect_routed_location();
create trigger dispatch_notifications_prevent_delete
  before delete on public.dispatch_notifications
  for each row execute function public.prevent_row_mutation();
create trigger payments_prevent_delete
  before delete on public.payments
  for each row execute function public.prevent_row_mutation();
create trigger payment_refunds_protect_identity
  before update on public.payment_refunds
  for each row execute function public.protect_refund_identity();
create trigger payment_refunds_prevent_delete
  before delete on public.payment_refunds
  for each row execute function public.prevent_row_mutation();
create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.prevent_row_mutation();

-- Dispatchers can update dispatch state but cannot insert/delete bookings or alter payment data.
drop policy "operations dispatch manage bookings" on public.bookings;
create policy "operations manage bookings" on public.bookings
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));
create policy "dispatchers update bookings" on public.bookings
  for update to authenticated
  using (public.is_admin(array['dispatcher']::public.admin_role[]))
  with check (public.is_admin(array['dispatcher']::public.admin_role[]));

-- Notification outbox rows are durable. Dispatchers can process, but never create/delete, rows.
drop policy "dispatch manage notifications" on public.dispatch_notifications;
create policy "operations manage notifications" on public.dispatch_notifications
  for all to authenticated
  using (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]))
  with check (public.is_admin(array['super_admin', 'operations_admin']::public.admin_role[]));
create policy "dispatchers update notifications" on public.dispatch_notifications
  for update to authenticated
  using (public.is_admin(array['dispatcher']::public.admin_role[]))
  with check (public.is_admin(array['dispatcher']::public.admin_role[]));

comment on function public.validate_booking_state() is
  'Enforces payment-to-booking consistency and limits dispatcher writes to dispatch status.';
comment on function public.create_payment_attempt(uuid, text, bytea) is
  'Concurrency-safe service-role payment idempotency boundary.';
comment on function public.record_payment_provider_event(uuid, text, text, bytea) is
  'Concurrency-safe provider event replay ledger boundary.';
comment on function public.enqueue_dispatch_notification(uuid, text, public.notification_channel, text, text) is
  'Concurrency-safe durable dispatch outbox boundary.';

commit;
