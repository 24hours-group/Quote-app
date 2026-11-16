begin;

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
  from public.payments as payment_row
  where payment_row.provider = 'stripe'
    and payment_row.provider_payment_id = target_provider_payment_id
  for update;

  if not found then
    raise exception 'Stripe payment was not found' using errcode = 'P0002';
  end if;

  select * into target_event
  from public.payment_provider_events as event_row
  where event_row.provider_event_id = target_provider_event_id
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
    from public.bookings as booking_row
    where booking_row.payment_id = target_payment.id;

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
    from public.bookings as booking_row
    where booking_row.payment_id = target_payment.id
       or booking_row.booking_session_id = target_session.id
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
    from public.bookings as booking_row
    where booking_row.payment_id = target_payment.id;
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

commit;
