begin;

alter table public.customers
  alter column phone_verified_at drop not null;

alter table public.customers
  drop constraint if exists customers_phone_e164_key;
alter table public.customers
  drop constraint if exists customers_phone_e164_check;
alter table public.customers
  add constraint customers_phone_e164_check
    check (phone_e164 ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$');

create unique index customers_verified_phone_e164_uidx
  on public.customers (phone_e164)
  where phone_verified_at is not null;
create index customers_unverified_phone_e164_idx
  on public.customers (phone_e164)
  where phone_verified_at is null;

create or replace function public.normalize_us_phone_e164(input_phone text)
returns text
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  digits text;
begin
  if input_phone ~* '[a-z]' then
    raise exception 'Invalid US phone number' using errcode = '22023';
  end if;

  digits := regexp_replace(input_phone, '[^0-9]', '', 'g');
  if char_length(digits) = 11 and left(digits, 1) = '1' then
    digits := substring(digits from 2);
  end if;
  if digits !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' then
    raise exception 'Invalid US phone number' using errcode = '22023';
  end if;
  return '+1' || digits;
end;
$$;

create or replace function public.attach_unverified_customer_to_session(
  target_access_token_hash bytea,
  expected_version bigint,
  target_full_name text,
  target_receipt_email text,
  target_phone text,
  target_sms_consent boolean
)
returns table (
  booking_session_id uuid,
  customer_id uuid,
  session_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.booking_sessions%rowtype;
  existing_customer public.customers%rowtype;
  attached_customer_id uuid;
  normalized_phone text;
  normalized_name text;
  normalized_email text;
  next_answers jsonb;
begin
  normalized_phone := public.normalize_us_phone_e164(target_phone);
  normalized_name := trim(target_full_name);
  normalized_email := lower(trim(target_receipt_email));

  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or expected_version is null
    or expected_version < 0
    or char_length(normalized_name) not between 3 and 160
    or normalized_name !~ '.+\s+.+'
    or char_length(normalized_email) > 320
    or normalized_email !~* '^[A-Z0-9.!#$%&''*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?)+$'
    or target_sms_consent is null
  then
    raise exception 'Invalid booking contact input' using errcode = '22023';
  end if;

  select * into target_session
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and completed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Active booking session not found' using errcode = 'P0002';
  end if;
  if target_session.version <> expected_version then
    raise exception 'Booking draft version conflict' using errcode = '40001';
  end if;

  if target_session.customer_id is not null then
    select * into existing_customer
    from public.customers
    where id = target_session.customer_id
    for update;
  end if;

  if existing_customer.id is not null
    and existing_customer.phone_verified_at is null
    and existing_customer.auth_user_id is null
  then
    update public.customers
    set full_name = normalized_name,
        receipt_email = normalized_email,
        phone_e164 = normalized_phone,
        sms_consent = target_sms_consent,
        sms_consent_at = case when target_sms_consent then now() else null end,
        updated_at = now()
    where id = existing_customer.id
    returning id into attached_customer_id;
  else
    insert into public.customers (
      full_name, receipt_email, phone_e164, phone_verified_at,
      sms_consent, sms_consent_at
    ) values (
      normalized_name, normalized_email, normalized_phone, null,
      target_sms_consent, case when target_sms_consent then now() else null end
    ) returning id into attached_customer_id;
  end if;

  next_answers := coalesce(target_session.draft_payload->'answers', '{}'::jsonb)
    - 'verificationCode' - 'codeStatus' - 'codeAttempts';
  next_answers := next_answers || jsonb_build_object(
    'fullName', normalized_name,
    'receiptEmail', normalized_email,
    'mobileNumber', normalized_phone,
    'textConsent', target_sms_consent,
    'contactAttached', true
  );

  update public.booking_sessions
  set customer_id = attached_customer_id,
      draft_payload = jsonb_set(
        coalesce(target_session.draft_payload, '{}'::jsonb),
        '{answers}', next_answers, true
      )
  where id = target_session.id;

  return query
  select target_session.id, attached_customer_id, sessions.version
  from public.booking_sessions sessions
  where sessions.id = target_session.id;
end;
$$;

create or replace function public.detach_booking_customer_from_session(
  target_access_token_hash bytea,
  expected_version bigint
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.booking_sessions%rowtype;
  detached_customer_id uuid;
begin
  select * into target_session
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and completed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Active booking session not found' using errcode = 'P0002';
  end if;
  if target_session.version <> expected_version then
    raise exception 'Booking draft version conflict' using errcode = '40001';
  end if;

  detached_customer_id := target_session.customer_id;
  update public.booking_sessions
  set customer_id = null,
      draft_payload = jsonb_set(
        draft_payload,
        '{answers}',
        coalesce(draft_payload->'answers', '{}'::jsonb) - 'contactAttached',
        true
      )
  where id = target_session.id;

  delete from public.customers customer
  where customer.id = detached_customer_id
    and customer.phone_verified_at is null
    and customer.auth_user_id is null
    and not exists (
      select 1 from public.booking_sessions session
      where session.customer_id = customer.id
    );

  return (select version from public.booking_sessions where id = target_session.id);
end;
$$;

revoke all on function public.normalize_us_phone_e164(text)
  from public, anon, authenticated;
revoke all on function public.attach_unverified_customer_to_session(bytea, bigint, text, text, text, boolean)
  from public, anon, authenticated;
revoke all on function public.detach_booking_customer_from_session(bytea, bigint)
  from public, anon, authenticated;
grant execute on function public.attach_unverified_customer_to_session(bytea, bigint, text, text, text, boolean)
  to service_role;
grant execute on function public.detach_booking_customer_from_session(bytea, bigint)
  to service_role;

revoke execute on function public.start_booking_phone_verification(bytea, bigint, text, text, text, timestamptz, timestamptz)
  from service_role;
revoke execute on function public.record_booking_phone_verification_check(bytea, bigint, text, text, text, timestamptz)
  from service_role;
revoke execute on function public.load_booking_phone_verification(bytea)
  from service_role;
revoke execute on function public.invalidate_booking_phone_verification(bytea, bigint)
  from service_role;

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
    'schemaVersion', 2,
    'audience', target_audience,
    'booking', jsonb_build_object(
      'id', booking.id, 'reference', booking.reference,
      'status', booking.payment_status, 'bookedAt', booking.booked_at
    ),
    'customer', jsonb_build_object(
      'fullName', customer.full_name,
      'phoneE164', customer.phone_e164,
      'phoneVerified', customer.phone_verified_at is not null,
      'receiptEmail', customer.receipt_email,
      'smsConsent', customer.sms_consent
    ),
    'vehicle', jsonb_build_object(
      'year', vehicle.model_year, 'make', vehicle.make, 'model', vehicle.model,
      'heavyDuty', vehicle.is_heavy_duty, 'classification', vehicle.classification
    ),
    'service', jsonb_build_object(
      'type', request.service_type, 'answers', request.structured_answers,
      'notes', coalesce(request.customer_notes, quote.pricing_snapshot->>'customerNotes'),
      'specialFlags', request.special_flags || coalesce(quote.pricing_snapshot->'specialFlags', '{}'::jsonb)
    ),
    'pickup', jsonb_build_object(
      'address', pickup.formatted_address, 'latitude', pickup.latitude,
      'longitude', pickup.longitude, 'timezone', pickup.timezone,
      'landmarks', coalesce(quote.pricing_snapshot->>'landmarks', session.draft_payload #>> '{answers,landmarks}')
    ),
    'dropoff', case when dropoff.id is null then null else jsonb_build_object(
      'address', dropoff.formatted_address, 'latitude', dropoff.latitude,
      'longitude', dropoff.longitude, 'timezone', dropoff.timezone
    ) end,
    'route', case when route.id is null then null else jsonb_build_object(
      'distanceMeters', route.route_distance_meters, 'rawMiles', route.raw_miles,
      'billableMiles', route.billable_miles, 'calculatedAt', route.calculated_at
    ) end,
    'quote', jsonb_build_object(
      'id', quote.id, 'pricingVersion', quote.pricing_version,
      'currency', quote.currency, 'totalCents', quote.total_cents,
      'lineItems', coalesce((
        select jsonb_agg(jsonb_build_object(
          'code', line.item_code, 'description', line.description,
          'quantity', line.quantity, 'unitAmountCents', line.unit_amount_cents,
          'totalAmountCents', line.total_amount_cents,
          'payableNow', line.payable_now,
          'confirmationRequired', line.confirmation_required
        ) order by line.sort_order, line.created_at)
        from public.quote_line_items line where line.quote_id = quote.id
      ), '[]'::jsonb)
    ),
    'payment', jsonb_build_object(
      'id', payment.id, 'provider', payment.provider,
      'providerReference', payment.provider_payment_id,
      'status', payment.status, 'amountCents', payment.amount_cents,
      'currency', payment.currency, 'paidAt', payment.processed_at
    ),
    'company', jsonb_build_object(
      'name', settings.company_name, 'supportPhone', settings.support_phone_e164
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

comment on column public.customers.phone_verified_at is
  'Null when only US/NANP formatting was validated; non-null only after actual ownership verification.';
comment on function public.attach_unverified_customer_to_session(bytea, bigint, text, text, text, boolean) is
  'Creates or updates an isolated unverified booking contact without matching customers by phone.';

commit;
