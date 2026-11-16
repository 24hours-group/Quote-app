begin;

alter table public.payments
  add constraint payments_request_fingerprint_length_check
  check (octet_length(request_fingerprint) = 32) not valid;

alter table public.payments
  validate constraint payments_request_fingerprint_length_check;

create or replace function public.reserve_session_payment_attempt(
  target_access_token_hash bytea,
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
  target_session public.booking_sessions%rowtype;
  target_quote public.quotes%rowtype;
  target_payment public.payments%rowtype;
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or fingerprint is null
    or octet_length(fingerprint) <> 32
    or char_length(request_key) not between 16 and 255
  then
    raise exception 'Valid payment authorization and idempotency values are required'
      using errcode = '22023';
  end if;

  select * into target_session
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and customer_id is not null
    and completed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Active booking session not found' using errcode = 'P0002';
  end if;

  select * into target_quote
  from public.quotes
  where id = target_quote_id
    and booking_session_id = target_session.id
  for update;

  if not found then
    raise exception 'Accepted quote not found' using errcode = 'P0002';
  end if;

  if target_quote.status <> 'accepted' or target_quote.valid_until <= now() then
    raise exception 'Payments require an accepted, unexpired quote'
      using errcode = 'P0003';
  end if;

  select * into target_payment
  from public.payments
  where idempotency_key = request_key
     or (
       quote_id = target_quote.id
       and status in (
         'pending', 'processing', 'requires_action', 'succeeded',
         'partially_refunded', 'refunded'
       )
     )
  order by (idempotency_key = request_key) desc, created_at desc
  limit 1
  for update;

  if found then
    if target_payment.quote_id is distinct from target_quote.id
      or target_payment.request_fingerprint is distinct from fingerprint
    then
      raise exception 'Payment idempotency identity conflicts with an existing request'
        using errcode = '23505';
    end if;
    return target_payment;
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
  returning * into target_payment;

  return target_payment;
end;
$$;

create or replace function public.bind_session_payment_provider_id(
  target_access_token_hash bytea,
  target_payment_id uuid,
  target_provider_payment_id text
)
returns public.payments
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_payment public.payments%rowtype;
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or nullif(trim(target_provider_payment_id), '') is null
  then
    raise exception 'Valid payment authorization and provider ID are required'
      using errcode = '22023';
  end if;

  select payment.* into target_payment
  from public.payments payment
  join public.quotes quote on quote.id = payment.quote_id
  join public.booking_sessions session on session.id = quote.booking_session_id
  where payment.id = target_payment_id
    and session.access_token_hash = target_access_token_hash
    and session.completed_at is null
    and session.expires_at > now()
  for update of payment;

  if not found then
    raise exception 'Authorized payment not found' using errcode = 'P0002';
  end if;

  if target_payment.provider_payment_id is not null
    and target_payment.provider_payment_id is distinct from target_provider_payment_id
  then
    raise exception 'Payment provider identity is immutable' using errcode = '23000';
  end if;

  if target_payment.provider_payment_id is null then
    update public.payments
    set provider_payment_id = target_provider_payment_id,
        updated_at = now()
    where id = target_payment.id
    returning * into target_payment;
  end if;

  return target_payment;
end;
$$;

create or replace function public.apply_stripe_payment_event(
  target_provider_event_id text,
  target_event_type text,
  target_payload_hash bytea,
  target_provider_payment_id text,
  target_payment_status public.payment_status,
  target_amount_received integer default null,
  target_currency text default null
)
returns table (
  payment_id uuid,
  payment_status public.payment_status,
  booking_id uuid,
  booking_reference text,
  dispatch_status public.dispatch_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_payment public.payments%rowtype;
  target_event public.payment_provider_events%rowtype;
  target_quote public.quotes%rowtype;
  target_session public.booking_sessions%rowtype;
  target_booking public.bookings%rowtype;
  dispatch_recipient text;
  next_status public.payment_status;
  ignored_event boolean := false;
begin
  if nullif(trim(target_provider_event_id), '') is null
    or nullif(trim(target_event_type), '') is null
    or target_payload_hash is null
    or octet_length(target_payload_hash) <> 32
    or nullif(trim(target_provider_payment_id), '') is null
    or target_payment_status is null
  then
    raise exception 'Complete Stripe event identity is required' using errcode = '22023';
  end if;

  select * into target_payment
  from public.payments
  where provider = 'stripe'
    and provider_payment_id = target_provider_payment_id
  for update;

  if not found then
    raise exception 'Stripe payment was not found' using errcode = 'P0002';
  end if;

  select * into target_event
  from public.payment_provider_events
  where provider_event_id = target_provider_event_id
  for update;

  if found then
    if target_event.payment_id is distinct from target_payment.id
      or target_event.event_type is distinct from target_event_type
      or target_event.payload_hash is distinct from target_payload_hash
    then
      raise exception 'Provider event ID was reused with different content'
        using errcode = '23505';
    end if;
  else
    insert into public.payment_provider_events (
      payment_id,
      provider_event_id,
      event_type,
      payload_hash
    ) values (
      target_payment.id,
      target_provider_event_id,
      target_event_type,
      target_payload_hash
    )
    returning * into target_event;
  end if;

  if target_event.processed_at is not null then
    select * into target_booking
    from public.bookings
    where payment_id = target_payment.id;

    return query select
      target_payment.id,
      target_payment.status,
      target_booking.id,
      target_booking.reference,
      target_booking.dispatch_status;
    return;
  end if;

  if target_payment_status = 'succeeded' then
    if target_amount_received is distinct from target_payment.amount_cents
      or upper(target_currency) is distinct from target_payment.currency
    then
      update public.payment_provider_events
      set processed_at = now(),
          processing_error_code = 'amount_or_currency_mismatch'
      where id = target_event.id;
      raise exception 'Succeeded payment amount or currency does not match the quote'
        using errcode = '23514';
    end if;

    if target_payment.status in ('pending', 'processing', 'requires_action') then
      next_status := 'succeeded';
    elsif target_payment.status in ('succeeded', 'partially_refunded', 'refunded') then
      next_status := target_payment.status;
      ignored_event := true;
    else
      next_status := target_payment.status;
      ignored_event := true;
    end if;
  elsif target_payment.status in ('succeeded', 'partially_refunded', 'refunded', 'cancelled') then
    next_status := target_payment.status;
    ignored_event := true;
  elsif target_payment_status = 'processing'
    and target_payment.status in ('pending', 'requires_action')
  then
    next_status := 'processing';
  elsif target_payment_status = 'requires_action'
    and target_payment.status in ('pending', 'processing', 'requires_action')
  then
    next_status := 'requires_action';
  elsif target_payment_status = 'cancelled'
    and target_payment.status in ('pending', 'processing', 'requires_action')
  then
    next_status := 'cancelled';
  else
    next_status := target_payment.status;
    ignored_event := true;
  end if;

  update public.payments
  set status = next_status,
      latest_provider_event_id = target_provider_event_id,
      processed_at = case
        when next_status = 'succeeded' then coalesce(processed_at, now())
        else processed_at
      end,
      failed_at = case
        when next_status in ('failed', 'cancelled') then coalesce(failed_at, now())
        else failed_at
      end,
      updated_at = now()
  where id = target_payment.id
  returning * into target_payment;

  if target_payment.status = 'succeeded' then
    select * into target_quote
    from public.quotes
    where id = target_payment.quote_id;

    select * into target_session
    from public.booking_sessions
    where id = target_quote.booking_session_id;

    if target_session.customer_id is null then
      raise exception 'Verified customer is required for booking creation'
        using errcode = '23514';
    end if;

    select * into target_booking
    from public.bookings
    where payment_id = target_payment.id
       or booking_session_id = target_session.id
    for update;

    if not found then
      insert into public.bookings (
        customer_id,
        booking_session_id,
        service_request_id,
        quote_id,
        payment_id,
        payment_status,
        dispatch_status
      ) values (
        target_session.customer_id,
        target_session.id,
        target_quote.service_request_id,
        target_quote.id,
        target_payment.id,
        'succeeded',
        'ready'
      )
      returning * into target_booking;
    elsif target_booking.payment_id is distinct from target_payment.id
      or target_booking.quote_id is distinct from target_quote.id
    then
      raise exception 'Booking identity conflicts with the succeeded payment'
        using errcode = '23505';
    end if;

    select dispatch_email into dispatch_recipient
    from public.application_settings
    where setting_scope = 'default';

    if dispatch_recipient is null then
      raise exception 'Dispatch recipient is not configured' using errcode = 'P0002';
    end if;

    perform public.enqueue_dispatch_notification(
      target_booking.id,
      'booking.paid',
      'email'::public.notification_channel,
      dispatch_recipient,
      'dispatch:booking-paid:' || target_booking.id::text
    );
  else
    select * into target_booking
    from public.bookings
    where payment_id = target_payment.id;
  end if;

  update public.payment_provider_events
  set processed_at = now(),
      processing_error_code = case when ignored_event then 'ignored_stale_event' else null end
  where id = target_event.id;

  return query select
    target_payment.id,
    target_payment.status,
    target_booking.id,
    target_booking.reference,
    target_booking.dispatch_status;
end;
$$;

create or replace function public.lookup_session_payment_status(
  target_access_token_hash bytea,
  target_payment_id uuid default null,
  target_booking_reference text default null
)
returns table (
  payment_id uuid,
  payment_status public.payment_status,
  amount_cents integer,
  currency text,
  processed_at timestamptz,
  booking_id uuid,
  booking_reference text,
  dispatch_status public.dispatch_status
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or ((target_payment_id is null) = (target_booking_reference is null))
  then
    raise exception 'Exactly one valid payment lookup identifier is required'
      using errcode = '22023';
  end if;

  return query
  select
    payment.id,
    payment.status,
    payment.amount_cents,
    payment.currency,
    payment.processed_at,
    booking.id,
    booking.reference,
    booking.dispatch_status
  from public.booking_sessions session
  join public.quotes quote on quote.booking_session_id = session.id
  join public.payments payment on payment.quote_id = quote.id
  left join public.bookings booking on booking.payment_id = payment.id
  where session.access_token_hash = target_access_token_hash
    and session.expires_at > now()
    and (
      (target_payment_id is not null and payment.id = target_payment_id)
      or (target_booking_reference is not null and booking.reference = target_booking_reference)
    )
  limit 1;

  if not found then
    raise exception 'Authorized payment or booking was not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.reserve_session_payment_attempt(bytea, uuid, text, bytea)
  from public, anon, authenticated;
revoke all on function public.bind_session_payment_provider_id(bytea, uuid, text)
  from public, anon, authenticated;
revoke all on function public.apply_stripe_payment_event(text, text, bytea, text, public.payment_status, integer, text)
  from public, anon, authenticated;
revoke all on function public.lookup_session_payment_status(bytea, uuid, text)
  from public, anon, authenticated;

grant execute on function public.reserve_session_payment_attempt(bytea, uuid, text, bytea)
  to service_role;
grant execute on function public.bind_session_payment_provider_id(bytea, uuid, text)
  to service_role;
grant execute on function public.apply_stripe_payment_event(text, text, bytea, text, public.payment_status, integer, text)
  to service_role;
grant execute on function public.lookup_session_payment_status(bytea, uuid, text)
  to service_role;

comment on function public.apply_stripe_payment_event(text, text, bytea, text, public.payment_status, integer, text) is
  'Applies an already signature-verified Stripe event and atomically creates the paid booking and dispatch outbox row.';

commit;
