begin;

alter table public.customers
  add column receipt_email text;

alter table public.customers
  add constraint customers_receipt_email_check
  check (
    receipt_email is null
    or receipt_email ~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
  );

alter table public.dispatch_notifications
  add column payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  add column payload_version smallint not null default 1
    check (payload_version > 0),
  add column template_key text not null default 'legacy.notification'
    check (template_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  add column template_version smallint not null default 1
    check (template_version > 0),
  add column provider text
    check (provider is null or provider in ('resend', 'twilio')),
  add column lease_token uuid,
  add column leased_until timestamptz,
  add column dead_lettered_at timestamptz;

update public.dispatch_notifications
set next_attempt_at = coalesce(next_attempt_at, created_at)
where delivery_status in ('pending', 'failed');

update public.dispatch_notifications
set delivery_status = 'failed',
    next_attempt_at = now(),
    last_error_code = 'legacy_processing_recovered'
where delivery_status = 'processing';

update public.dispatch_notifications
set delivered_at = coalesce(delivered_at, last_attempt_at, updated_at)
where delivery_status = 'delivered';

update public.dispatch_notifications
set delivered_at = null
where delivery_status <> 'delivered' and delivered_at is not null;

update public.dispatch_notifications
set dead_lettered_at = coalesce(dead_lettered_at, last_attempt_at, updated_at)
where delivery_status = 'dead_letter';

update public.dispatch_notifications
set delivery_status = 'dead_letter',
    next_attempt_at = null,
    dead_lettered_at = coalesce(dead_lettered_at, last_attempt_at, updated_at, now()),
    lease_token = null,
    leased_until = null
where delivery_status in ('pending', 'failed', 'processing')
  and retry_count >= max_attempts;

alter table public.dispatch_notifications
  add constraint dispatch_notifications_lease_state_check check (
    (delivery_status = 'processing' and lease_token is not null and leased_until is not null)
    or (delivery_status <> 'processing' and lease_token is null and leased_until is null)
  ),
  add constraint dispatch_notifications_delivery_timestamp_check check (
    (delivery_status = 'delivered' and delivered_at is not null)
    or (delivery_status <> 'delivered' and delivered_at is null)
  ),
  add constraint dispatch_notifications_dead_letter_timestamp_check check (
    (delivery_status = 'dead_letter' and dead_lettered_at is not null)
    or (delivery_status <> 'dead_letter' and dead_lettered_at is null)
  );

create or replace function public.set_verified_customer_receipt_email(
  target_access_token_hash bytea,
  target_receipt_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_customer_id uuid;
  target_full_name text;
  normalized_email text;
begin
  normalized_email := lower(trim(target_receipt_email));
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or normalized_email !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
  then
    raise exception 'A valid receipt email and session authorization are required'
      using errcode = '22023';
  end if;

  select session.customer_id, verification.full_name
  into target_customer_id, target_full_name
  from public.booking_sessions session
  join public.booking_phone_verifications verification
    on verification.booking_session_id = session.id
  where session.access_token_hash = target_access_token_hash
    and session.completed_at is null
    and session.expires_at > now()
    and verification.status = 'verified'
    and verification.verified_at is not null
  for update of session;

  if target_customer_id is null then
    raise exception 'Verified customer session not found' using errcode = 'P0002';
  end if;

  update public.customers
  set full_name = target_full_name,
      receipt_email = normalized_email,
      updated_at = now()
  where id = target_customer_id;

  return target_customer_id;
end;
$$;

create or replace function public.build_booking_notification_payload(
  target_booking_id uuid,
  target_audience text
)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  result jsonb;
begin
  if target_audience not in ('dispatch', 'customer') then
    raise exception 'Unsupported notification audience' using errcode = '22023';
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 1,
    'audience', target_audience,
    'booking', jsonb_build_object(
      'id', booking.id,
      'reference', booking.reference,
      'status', booking.payment_status,
      'bookedAt', booking.booked_at
    ),
    'customer', jsonb_build_object(
      'fullName', customer.full_name,
      'verifiedPhone', customer.phone_e164,
      'receiptEmail', customer.receipt_email
    ),
    'vehicle', jsonb_build_object(
      'year', vehicle.model_year,
      'make', vehicle.make,
      'model', vehicle.model,
      'heavyDuty', vehicle.is_heavy_duty,
      'classification', vehicle.classification
    ),
    'service', jsonb_build_object(
      'type', request.service_type,
      'answers', request.structured_answers,
      'notes', coalesce(request.customer_notes, quote.pricing_snapshot->>'customerNotes'),
      'specialFlags', request.special_flags || coalesce(quote.pricing_snapshot->'specialFlags', '{}'::jsonb)
    ),
    'pickup', jsonb_build_object(
      'address', pickup.formatted_address,
      'latitude', pickup.latitude,
      'longitude', pickup.longitude,
      'timezone', pickup.timezone,
      'landmarks', coalesce(
        quote.pricing_snapshot->>'landmarks',
        session.draft_payload #>> '{answers,landmarks}'
      )
    ),
    'dropoff', case when dropoff.id is null then null else jsonb_build_object(
      'address', dropoff.formatted_address,
      'latitude', dropoff.latitude,
      'longitude', dropoff.longitude,
      'timezone', dropoff.timezone
    ) end,
    'route', case when route.id is null then null else jsonb_build_object(
      'distanceMeters', route.route_distance_meters,
      'rawMiles', route.raw_miles,
      'billableMiles', route.billable_miles,
      'calculatedAt', route.calculated_at
    ) end,
    'quote', jsonb_build_object(
      'id', quote.id,
      'pricingVersion', quote.pricing_version,
      'currency', quote.currency,
      'totalCents', quote.total_cents,
      'lineItems', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', line.item_code,
          'description', line.description,
          'quantity', line.quantity,
          'unitAmountCents', line.unit_amount_cents,
          'totalAmountCents', line.total_amount_cents,
          'payableNow', line.payable_now,
          'confirmationRequired', line.confirmation_required
        ) order by line.sort_order, line.created_at)
        from public.quote_line_items line
        where line.quote_id = quote.id
      ), '[]'::jsonb)
    ),
    'payment', jsonb_build_object(
      'id', payment.id,
      'provider', payment.provider,
      'providerReference', payment.provider_payment_id,
      'status', payment.status,
      'amountCents', payment.amount_cents,
      'currency', payment.currency,
      'paidAt', payment.processed_at
    ),
    'company', jsonb_build_object(
      'name', settings.company_name,
      'supportPhone', settings.support_phone_e164
    )
  )) into result
  from public.bookings booking
  join public.booking_sessions session on session.id = booking.booking_session_id
  join public.customers customer on customer.id = booking.customer_id
  join public.service_requests request on request.id = booking.service_request_id
  join public.vehicles vehicle on vehicle.id = request.vehicle_id
  join public.locations pickup on pickup.id = request.pickup_location_id
  left join public.locations dropoff on dropoff.id = request.dropoff_location_id
  join public.quotes quote on quote.id = booking.quote_id
  join public.payments payment on payment.id = booking.payment_id
  left join public.route_calculations route on route.id = quote.route_calculation_id
  join public.application_settings settings on settings.setting_scope = 'default'
  where booking.id = target_booking_id
    and booking.payment_status = 'succeeded'
    and payment.status = 'succeeded';

  if result is null then
    raise exception 'Paid booking notification data was not found' using errcode = 'P0002';
  end if;
  return result;
end;
$$;

update public.dispatch_notifications notification
set payload = public.build_booking_notification_payload(notification.booking_id, 'dispatch'),
    payload_version = 1,
    template_key = 'dispatch.booking_paid',
    template_version = 1,
    next_attempt_at = coalesce(notification.next_attempt_at, now())
where notification.event_name = 'booking.paid'
  and notification.channel = 'email'
  and notification.delivery_status in ('pending', 'failed');

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
    or new.payload is distinct from old.payload
    or new.payload_version is distinct from old.payload_version
    or new.template_key is distinct from old.template_key
    or new.template_version is distinct from old.template_version
    or new.created_at is distinct from old.created_at
    or (old.provider is not null and new.provider is distinct from old.provider)
  then
    raise exception 'Dispatch notification identity is immutable' using errcode = '23000';
  end if;
  return new;
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
  audience text;
  selected_template text;
begin
  audience := case
    when target_event_name = 'booking.paid' then 'dispatch'
    else 'customer'
  end;
  selected_template := case target_event_name
    when 'booking.paid' then 'dispatch.booking_paid'
    when 'booking.paid.customer_receipt' then 'customer.payment_receipt'
    when 'booking.paid.customer_sms' then 'customer.payment_sms'
    else 'legacy.notification'
  end;

  begin
    insert into public.dispatch_notifications (
      booking_id, event_name, channel, recipient, idempotency_key,
      payload, payload_version, template_key, template_version, next_attempt_at
    ) values (
      target_booking_id, target_event_name, target_channel, trim(target_recipient), request_key,
      public.build_booking_notification_payload(target_booking_id, audience),
      1, selected_template, 1, now()
    ) returning * into existing_notification;
  exception when unique_violation then
    select * into existing_notification
    from public.dispatch_notifications
    where idempotency_key = request_key
       or (
         booking_id = target_booking_id
         and event_name = target_event_name
         and channel = target_channel
         and recipient = trim(target_recipient)
       )
    limit 1;
  end;

  if existing_notification.id is null
    or existing_notification.booking_id is distinct from target_booking_id
    or existing_notification.event_name is distinct from target_event_name
    or existing_notification.channel is distinct from target_channel
    or existing_notification.recipient is distinct from trim(target_recipient)
    or existing_notification.idempotency_key is distinct from request_key
  then
    raise exception 'Dispatch idempotency key or event identity conflicts with an existing request'
      using errcode = '23505';
  end if;
  return existing_notification;
end;
$$;

create or replace function public.enqueue_paid_booking_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_record public.customers%rowtype;
  settings_record public.application_settings%rowtype;
begin
  if new.payment_status <> 'succeeded' then return new; end if;

  select * into settings_record from public.application_settings where setting_scope = 'default';
  select * into customer_record from public.customers where id = new.customer_id;
  if settings_record.dispatch_email is null then
    raise exception 'Dispatch recipient is not configured' using errcode = 'P0002';
  end if;

  perform public.enqueue_dispatch_notification(
    new.id, 'booking.paid', 'email', settings_record.dispatch_email,
    'dispatch:booking-paid:' || new.id::text
  );

  if customer_record.receipt_email is not null then
    perform public.enqueue_dispatch_notification(
      new.id, 'booking.paid.customer_receipt', 'email', customer_record.receipt_email,
      'customer:email:booking-paid:' || new.id::text
    );
  end if;

  if customer_record.sms_consent
    and settings_record.messages->>'sms_updates_enabled' = 'true'
  then
    perform public.enqueue_dispatch_notification(
      new.id, 'booking.paid.customer_sms', 'sms', customer_record.phone_e164,
      'customer:sms:booking-paid:' || new.id::text
    );
  end if;
  return new;
end;
$$;

create trigger bookings_enqueue_paid_notifications
  after insert on public.bookings
  for each row execute function public.enqueue_paid_booking_notifications();

create or replace function public.enqueue_notification_failure_alert(
  failed_notification public.dispatch_notifications
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  alert_recipient text;
  alert_event text;
  target_booking_reference text;
begin
  if failed_notification.template_key = 'operations.delivery_failure' then return; end if;
  select dispatch_email into alert_recipient
  from public.application_settings where setting_scope = 'default';
  if alert_recipient is null then return; end if;
  select reference into target_booking_reference
  from public.bookings where id = failed_notification.booking_id;
  alert_event := 'notification.dead-letter.' || failed_notification.id::text;

  insert into public.dispatch_notifications (
    booking_id, event_name, channel, recipient, idempotency_key,
    payload, payload_version, template_key, template_version, next_attempt_at
  ) values (
    failed_notification.booking_id, alert_event, 'email', alert_recipient,
    'alert:delivery-dead-letter:' || failed_notification.id::text,
    jsonb_build_object(
      'schemaVersion', 1,
      'sourceNotificationId', failed_notification.id,
      'bookingId', failed_notification.booking_id,
      'bookingReference', target_booking_reference,
      'eventName', failed_notification.event_name,
      'channel', failed_notification.channel,
      'retryCount', failed_notification.retry_count,
      'errorCode', failed_notification.last_error_code,
      'deadLetteredAt', failed_notification.dead_lettered_at
    ),
    1, 'operations.delivery_failure', 1, now()
  ) on conflict (idempotency_key) do nothing;
end;
$$;

create or replace function public.claim_dispatch_notifications(
  target_batch_size integer default 20,
  target_lease_seconds integer default 60
)
returns setof public.dispatch_notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  dead_notification public.dispatch_notifications%rowtype;
begin
  if target_batch_size not between 1 and 100
    or target_lease_seconds not between 15 and 900
  then
    raise exception 'Invalid notification claim limits' using errcode = '22023';
  end if;

  update public.dispatch_notifications
  set delivery_status = case
        when retry_count >= max_attempts then 'dead_letter'::public.delivery_status
        else 'failed'::public.delivery_status
      end,
      next_attempt_at = case when retry_count < max_attempts then now() else null end,
      last_error_code = 'worker_lease_expired',
      dead_lettered_at = case when retry_count >= max_attempts then now() else null end,
      lease_token = null,
      leased_until = null
  where delivery_status = 'processing'
    and leased_until < now();

  for dead_notification in
    select * from public.dispatch_notifications notification
    where notification.delivery_status = 'dead_letter'
      and notification.last_error_code = 'worker_lease_expired'
      and not exists (
        select 1 from public.dispatch_notifications alert
        where alert.idempotency_key = 'alert:delivery-dead-letter:' || notification.id::text
      )
  loop
    perform public.enqueue_notification_failure_alert(dead_notification);
  end loop;

  return query
  with candidates as (
    select notification.id
    from public.dispatch_notifications notification
    where notification.delivery_status in ('pending', 'failed')
      and coalesce(notification.next_attempt_at, notification.created_at) <= now()
      and notification.retry_count < notification.max_attempts
    order by coalesce(notification.next_attempt_at, notification.created_at), notification.created_at
    for update skip locked
    limit target_batch_size
  )
  update public.dispatch_notifications notification
  set delivery_status = 'processing',
      retry_count = notification.retry_count + 1,
      last_attempt_at = now(),
      next_attempt_at = null,
      lease_token = extensions.gen_random_uuid(),
      leased_until = now() + make_interval(secs => target_lease_seconds),
      last_error_code = null
  from candidates
  where notification.id = candidates.id
  returning notification.*;
end;
$$;

create or replace function public.mark_dispatch_notification_delivered(
  target_notification_id uuid,
  target_lease_token uuid,
  target_provider text,
  target_provider_message_id text
)
returns public.dispatch_notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification public.dispatch_notifications%rowtype;
begin
  select * into notification from public.dispatch_notifications
  where id = target_notification_id for update;
  if not found then raise exception 'Notification not found' using errcode = 'P0002'; end if;

  if notification.delivery_status = 'delivered' then
    if notification.provider is distinct from target_provider
      or notification.provider_message_id is distinct from target_provider_message_id
    then raise exception 'Delivery result conflicts with existing result' using errcode = '23505'; end if;
    return notification;
  end if;

  if notification.delivery_status <> 'processing'
    or notification.lease_token is distinct from target_lease_token
    or notification.leased_until < now()
  then raise exception 'Notification lease is invalid' using errcode = '40001'; end if;

  update public.dispatch_notifications
  set delivery_status = 'delivered', provider = target_provider,
      provider_message_id = target_provider_message_id, delivered_at = now(),
      lease_token = null, leased_until = null, last_error_code = null
  where id = notification.id returning * into notification;

  if notification.event_name = 'booking.paid' then
    update public.bookings set dispatch_status = 'notified', updated_at = now()
    where id = notification.booking_id and dispatch_status = 'ready';
  end if;
  return notification;
end;
$$;

create or replace function public.mark_dispatch_notification_failed(
  target_notification_id uuid,
  target_lease_token uuid,
  target_provider text,
  target_error_code text,
  target_permanent boolean default false
)
returns public.dispatch_notifications
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification public.dispatch_notifications%rowtype;
  should_dead_letter boolean;
  delay_seconds integer;
begin
  if target_error_code !~ '^[a-z][a-z0-9_]{1,99}$' then
    raise exception 'Invalid delivery error code' using errcode = '22023';
  end if;
  select * into notification from public.dispatch_notifications
  where id = target_notification_id for update;
  if not found then raise exception 'Notification not found' using errcode = 'P0002'; end if;
  if notification.delivery_status <> 'processing'
    or notification.lease_token is distinct from target_lease_token
    or notification.leased_until < now()
  then raise exception 'Notification lease is invalid' using errcode = '40001'; end if;

  should_dead_letter := target_permanent or notification.retry_count >= notification.max_attempts;
  delay_seconds := case notification.retry_count
    when 1 then 30 when 2 then 120 when 3 then 480 when 4 then 1800 else 7200
  end;

  update public.dispatch_notifications
  set delivery_status = case when should_dead_letter then 'dead_letter' else 'failed' end,
      provider = target_provider,
      last_error_code = target_error_code,
      next_attempt_at = case when should_dead_letter then null else now() + make_interval(secs => delay_seconds) end,
      dead_lettered_at = case when should_dead_letter then now() else null end,
      lease_token = null,
      leased_until = null
  where id = notification.id returning * into notification;

  if should_dead_letter then
    perform public.enqueue_notification_failure_alert(notification);
  end if;
  return notification;
end;
$$;

create or replace function public.write_dispatch_notification_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_role, action, entity_table, entity_id, old_values, new_values
  ) values (
    current_user,
    lower(tg_op),
    'dispatch_notifications',
    coalesce(new.id, old.id),
    case when tg_op = 'UPDATE' then jsonb_build_object(
      'delivery_status', old.delivery_status,
      'retry_count', old.retry_count,
      'provider', old.provider,
      'last_error_code', old.last_error_code
    ) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then jsonb_build_object(
      'event_name', new.event_name,
      'channel', new.channel,
      'delivery_status', new.delivery_status,
      'retry_count', new.retry_count,
      'provider', new.provider,
      'last_error_code', new.last_error_code,
      'delivered_at', new.delivered_at,
      'dead_lettered_at', new.dead_lettered_at
    ) else null end
  );
  return new;
end;
$$;

drop trigger if exists audit_dispatch_notifications on public.dispatch_notifications;
create trigger audit_dispatch_notifications
  after insert or update on public.dispatch_notifications
  for each row execute function public.write_dispatch_notification_audit();

drop index if exists public.dispatch_notifications_queue_idx;
create index dispatch_notifications_worker_queue_idx
  on public.dispatch_notifications (coalesce(next_attempt_at, created_at), created_at)
  where delivery_status in ('pending', 'failed', 'processing');

revoke insert, update, delete on table public.dispatch_notifications from authenticated;
grant select on table public.dispatch_notifications to authenticated;

revoke all on function public.set_verified_customer_receipt_email(bytea, text) from public, anon, authenticated;
revoke all on function public.build_booking_notification_payload(uuid, text) from public, anon, authenticated;
revoke all on function public.enqueue_paid_booking_notifications() from public, anon, authenticated;
revoke all on function public.enqueue_notification_failure_alert(public.dispatch_notifications) from public, anon, authenticated;
revoke all on function public.write_dispatch_notification_audit() from public, anon, authenticated;
revoke all on function public.claim_dispatch_notifications(integer, integer) from public, anon, authenticated;
revoke all on function public.mark_dispatch_notification_delivered(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.mark_dispatch_notification_failed(uuid, uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.set_verified_customer_receipt_email(bytea, text) to service_role;
grant execute on function public.build_booking_notification_payload(uuid, text) to service_role;
grant execute on function public.claim_dispatch_notifications(integer, integer) to service_role;
grant execute on function public.mark_dispatch_notification_delivered(uuid, uuid, text, text) to service_role;
grant execute on function public.mark_dispatch_notification_failed(uuid, uuid, text, text, boolean) to service_role;

comment on column public.dispatch_notifications.payload is
  'Immutable, minimized point-in-time delivery payload; never contains payment card data or session credentials.';
comment on function public.claim_dispatch_notifications(integer, integer) is
  'Claims due outbox rows with SKIP LOCKED and time-bounded leases for at-least-once delivery.';

commit;
