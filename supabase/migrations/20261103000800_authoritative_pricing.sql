begin;

alter table public.pricing_parameters
  drop constraint if exists pricing_parameters_unit_check;
alter table public.pricing_parameters
  add constraint pricing_parameters_unit_check check (
    unit in (
      'cents', 'cents_per_mile', 'percent', 'miles', 'minutes',
      'boolean', 'count', 'feet'
    )
  );

alter table public.locations
  drop constraint if exists locations_booking_session_id_kind_key;
alter table public.service_requests
  drop constraint if exists service_requests_booking_session_id_key;

alter table public.quotes
  add column priced_at timestamptz not null default now(),
  add column pricing_timezone text not null default 'UTC',
  add column request_fingerprint bytea,
  add constraint quotes_pricing_timezone_check
    check (public.is_valid_iana_timezone(pricing_timezone)),
  add constraint quotes_request_fingerprint_check
    check (request_fingerprint is null or octet_length(request_fingerprint) = 32);

create unique index quotes_session_request_fingerprint_idx
  on public.quotes (booking_session_id, request_fingerprint)
  where request_fingerprint is not null;
create unique index quotes_one_accepted_session_idx
  on public.quotes (booking_session_id)
  where status = 'accepted';

alter table public.quote_line_items
  add column payable_now boolean not null default true,
  add column confirmation_required boolean not null default false,
  add column metadata jsonb not null default '{}'::jsonb,
  add constraint quote_line_items_metadata_object_check
    check (jsonb_typeof(metadata) = 'object');

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
  where quote_id = target_quote_id
    and payable_now;

  if actual_subtotal <> expected_subtotal then
    raise exception 'Payable quote line items (%) do not equal subtotal (%)', actual_subtotal, expected_subtotal
      using errcode = '23514';
  end if;

  return null;
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
    or new.priced_at is distinct from old.priced_at
    or new.pricing_timezone is distinct from old.pricing_timezone
    or new.request_fingerprint is distinct from old.request_fingerprint
    or new.created_at is distinct from old.created_at
  then
    raise exception 'Quote pricing snapshots cannot be changed after generation'
      using errcode = '23000';
  end if;
  return new;
end;
$$;

update public.pricing_parameters set is_active = false where is_active;

insert into public.pricing_parameters (
  parameter_key, value, unit, version, effective_from, is_active
) values
  ('day_start', 420, 'minutes', 2, '2026-01-01T00:00:00Z', true),
  ('day_end', 1140, 'minutes', 2, '2026-01-01T00:00:00Z', true),
  ('quote_valid_min', 30, 'minutes', 2, '2026-01-01T00:00:00Z', true),
  ('rounding', 1, 'boolean', 2, '2026-01-01T00:00:00Z', true),
  ('js_1_day', 15000, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('js_1_night', 20000, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('js_2', 22900, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('js_3', 26500, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('js_4', 29500, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('js_max_batteries', 4, 'count', 2, '2026-01-01T00:00:00Z', true),
  ('tire_day', 16500, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('tire_night', 20000, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('lockout_day', 15000, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('lockout_night', 20000, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('mech_day', 15000, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('mech_night', 30000, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('tow_hook_neutral_ok', 16900, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('tow_hook_neutral_fail', 18900, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('tow_rate_short', 800, 'cents_per_mile', 2, '2026-01-01T00:00:00Z', true),
  ('tow_rate_long', 1000, 'cents_per_mile', 2, '2026-01-01T00:00:00Z', true),
  ('tow_threshold_mi', 20, 'miles', 2, '2026-01-01T00:00:00Z', true),
  ('tow_max_mi', 100, 'miles', 2, '2026-01-01T00:00:00Z', true),
  ('gas_base', 19900, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('gas_price_per_gal', 400, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('gas_included_mi', 5, 'miles', 2, '2026-01-01T00:00:00Z', true),
  ('gas_rate_per_mi', 500, 'cents_per_mile', 2, '2026-01-01T00:00:00Z', true),
  ('winch_base', 28500, 'cents', 2, '2026-01-01T00:00:00Z', true),
  ('winch_included_ft', 10, 'feet', 2, '2026-01-01T00:00:00Z', true),
  ('winch_step_ft', 10, 'feet', 2, '2026-01-01T00:00:00Z', true),
  ('winch_step_price', 10000, 'cents', 2, '2026-01-01T00:00:00Z', true)
on conflict (parameter_key, version) do update set
  value = excluded.value,
  unit = excluded.unit,
  effective_from = excluded.effective_from,
  effective_to = null,
  is_active = true;

create or replace function public.create_authoritative_quote(
  target_access_token_hash bytea,
  target_expected_version bigint,
  target_request_fingerprint bytea,
  target_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.booking_sessions%rowtype;
  existing_quote_id uuid;
  vehicle_id uuid;
  pickup_id uuid;
  dropoff_id uuid;
  request_id uuid;
  route_id uuid;
  quote_id uuid;
  service_kind public.service_type;
  item jsonb;
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or target_expected_version is null
    or target_expected_version < 0
    or target_request_fingerprint is null
    or octet_length(target_request_fingerprint) <> 32
    or target_snapshot is null
    or jsonb_typeof(target_snapshot) is distinct from 'object'
    or jsonb_typeof(target_snapshot->'quote') is distinct from 'object'
    or case
      when jsonb_typeof(target_snapshot->'quote'->'lineItems') = 'array'
        then jsonb_array_length(target_snapshot->'quote'->'lineItems') = 0
      else true
    end
  then
    raise exception 'Invalid authoritative quote input' using errcode = '22023';
  end if;

  select * into target_session
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and completed_at is null
    and expires_at > now()
  for update;

  if not found or target_session.customer_id is null then
    raise exception 'Verified active booking session not found' using errcode = 'P0002';
  end if;
  if target_session.version <> target_expected_version then
    raise exception 'Booking session changed while generating the quote'
      using errcode = '40001';
  end if;

  select id into existing_quote_id
  from public.quotes
  where booking_session_id = target_session.id
    and request_fingerprint = target_request_fingerprint;
  if existing_quote_id is not null then
    return existing_quote_id;
  end if;

  if exists (
    select 1 from public.quotes
    where booking_session_id = target_session.id and status = 'accepted'
  ) then
    raise exception 'An accepted quote already exists for this booking session'
      using errcode = '23514';
  end if;

  update public.quotes
  set status = 'superseded'
  where booking_session_id = target_session.id
    and status = 'offered';

  insert into public.vehicles (
    booking_session_id, customer_id, model_year, make, model, is_heavy_duty
  ) values (
    target_session.id,
    target_session.customer_id,
    (target_snapshot->'vehicle'->>'year')::smallint,
    target_snapshot->'vehicle'->>'make',
    target_snapshot->'vehicle'->>'model',
    coalesce((target_snapshot->'vehicle'->>'isHeavyDuty')::boolean, false)
  ) returning id into vehicle_id;

  insert into public.locations (
    booking_session_id, kind, formatted_address, google_place_id,
    latitude, longitude, timezone, is_confirmed, confirmed_at
  ) values (
    target_session.id, 'pickup',
    target_snapshot->'pickup'->>'formattedAddress',
    target_snapshot->'pickup'->>'placeId',
    (target_snapshot->'pickup'->>'latitude')::numeric,
    (target_snapshot->'pickup'->>'longitude')::numeric,
    target_snapshot->'pickup'->>'timezone', true,
    (target_snapshot->'quote'->>'pricedAt')::timestamptz
  ) returning id into pickup_id;

  if jsonb_typeof(target_snapshot->'dropoff') = 'object' then
    insert into public.locations (
      booking_session_id, kind, formatted_address, google_place_id,
      latitude, longitude, timezone, is_confirmed, confirmed_at
    ) values (
      target_session.id, 'dropoff',
      target_snapshot->'dropoff'->>'formattedAddress',
      target_snapshot->'dropoff'->>'placeId',
      (target_snapshot->'dropoff'->>'latitude')::numeric,
      (target_snapshot->'dropoff'->>'longitude')::numeric,
      target_snapshot->'dropoff'->>'timezone', true,
      (target_snapshot->'quote'->>'pricedAt')::timestamptz
    ) returning id into dropoff_id;
  end if;

  service_kind := (target_snapshot->>'databaseServiceType')::public.service_type;
  insert into public.service_requests (
    booking_session_id, vehicle_id, pickup_location_id, dropoff_location_id,
    service_type, structured_answers, customer_notes
  ) values (
    target_session.id, vehicle_id, pickup_id, dropoff_id, service_kind,
    target_snapshot->'answers', nullif(target_snapshot->>'customerNotes', '')
  ) returning id into request_id;

  if jsonb_typeof(target_snapshot->'route') = 'object' then
    insert into public.route_calculations (
      booking_session_id, service_request_id, pickup_location_id,
      dropoff_location_id, route_distance_meters, raw_miles,
      billable_miles, provider_route_token, routing_metadata, calculated_at
    ) values (
      target_session.id, request_id, pickup_id, dropoff_id,
      (target_snapshot->'route'->>'distanceMeters')::integer,
      (target_snapshot->'route'->>'rawMiles')::numeric,
      (target_snapshot->'route'->>'billableMiles')::numeric,
      target_snapshot->'route'->>'calculationId',
      target_snapshot->'route'->'metadata',
      (target_snapshot->'route'->>'calculatedAt')::timestamptz
    ) returning id into route_id;
  end if;

  insert into public.quotes (
    booking_session_id, service_request_id, route_calculation_id,
    subtotal_cents, tax_cents, total_cents, currency, pricing_version,
    pricing_snapshot, status, valid_until, priced_at, pricing_timezone,
    request_fingerprint
  ) values (
    target_session.id, request_id, route_id,
    (target_snapshot->'quote'->>'totalPayableNowCents')::integer, 0,
    (target_snapshot->'quote'->>'totalPayableNowCents')::integer,
    target_snapshot->'quote'->>'currency',
    (target_snapshot->'quote'->>'pricingVersion')::integer,
    target_snapshot, 'draft',
    (target_snapshot->'quote'->>'validUntil')::timestamptz,
    (target_snapshot->'quote'->>'pricedAt')::timestamptz,
    target_snapshot->'quote'->>'timezone', target_request_fingerprint
  ) returning id into quote_id;

  for item in select * from jsonb_array_elements(target_snapshot->'quote'->'lineItems')
  loop
    insert into public.quote_line_items (
      quote_id, item_code, description, quantity, unit_amount_cents,
      total_amount_cents, sort_order, payable_now, confirmation_required, metadata
    ) values (
      quote_id, item->>'itemCode', item->>'description',
      (item->>'quantity')::numeric, (item->>'unitAmountCents')::integer,
      (item->>'totalAmountCents')::integer,
      coalesce((item->>'sortOrder')::smallint, 0),
      (item->>'payableNow')::boolean,
      (item->>'confirmationRequired')::boolean,
      coalesce(item->'metadata', '{}'::jsonb)
    );
  end loop;

  update public.quotes set status = 'offered' where id = quote_id;
  return quote_id;
exception
  when unique_violation then
    select id into existing_quote_id
    from public.quotes
    where booking_session_id = target_session.id
      and request_fingerprint = target_request_fingerprint;
    if existing_quote_id is not null then return existing_quote_id; end if;
    raise;
end;
$$;

revoke all on function public.create_authoritative_quote(bytea, bigint, bytea, jsonb)
  from public, anon, authenticated;
grant execute on function public.create_authoritative_quote(bytea, bigint, bytea, jsonb)
  to service_role;

comment on function public.create_authoritative_quote(bytea, bigint, bytea, jsonb) is
  'Creates one immutable, itemized, idempotent quote revision from server-validated booking data.';
comment on column public.quote_line_items.payable_now is
  'False for separately confirmed charges such as replacement tires or dispatcher-confirmed delivery mileage.';

commit;
