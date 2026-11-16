begin;

create type public.phone_verification_status as enum (
  'pending',
  'verified',
  'failed',
  'expired'
);

create table public.booking_phone_verifications (
  booking_session_id uuid primary key references public.booking_sessions(id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+1[2-9][0-9]{2}[2-9][0-9]{6}$'),
  full_name text not null check (char_length(trim(full_name)) between 3 and 160),
  sms_consent boolean not null check (sms_consent),
  status public.phone_verification_status not null default 'pending',
  incorrect_attempts smallint not null default 0 check (incorrect_attempts between 0 and 3),
  attempt_keys text[] not null default '{}'::text[] check (cardinality(attempt_keys) <= 3),
  provider_verification_sid text not null unique check (
    provider_verification_sid ~ '^VE[0-9A-Za-z]{32}$'
  ),
  sent_at timestamptz not null,
  expires_at timestamptz not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_phone_verifications_expiration_check check (expires_at > sent_at),
  constraint booking_phone_verifications_status_check check (
    (status = 'verified' and verified_at is not null)
    or (status <> 'verified' and verified_at is null)
  ),
  constraint booking_phone_verifications_failed_attempts_check check (
    status <> 'failed' or incorrect_attempts = 3
  )
);

create index booking_phone_verifications_pending_idx
  on public.booking_phone_verifications (expires_at)
  where status = 'pending';

create trigger booking_phone_verifications_updated_at
  before update on public.booking_phone_verifications
  for each row execute function public.set_updated_at();

alter table public.booking_phone_verifications enable row level security;
alter table public.booking_phone_verifications force row level security;
revoke all on table public.booking_phone_verifications
  from public, anon, authenticated, service_role;

create or replace function public.start_booking_phone_verification(
  target_access_token_hash bytea,
  expected_version bigint,
  target_phone_e164 text,
  target_full_name text,
  target_provider_verification_sid text,
  target_sent_at timestamptz,
  target_expires_at timestamptz
)
returns table (
  status public.phone_verification_status,
  incorrect_attempts smallint,
  phone_e164 text,
  expires_at timestamptz,
  session_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.booking_sessions%rowtype;
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

  insert into public.booking_phone_verifications (
    booking_session_id,
    phone_e164,
    full_name,
    sms_consent,
    status,
    incorrect_attempts,
    attempt_keys,
    provider_verification_sid,
    sent_at,
    expires_at,
    verified_at
  ) values (
    target_session.id,
    target_phone_e164,
    trim(target_full_name),
    true,
    'pending',
    0,
    '{}'::text[],
    target_provider_verification_sid,
    target_sent_at,
    target_expires_at,
    null
  )
  on conflict (booking_session_id) do update set
    phone_e164 = excluded.phone_e164,
    full_name = excluded.full_name,
    sms_consent = true,
    status = 'pending',
    incorrect_attempts = 0,
    attempt_keys = '{}'::text[],
    provider_verification_sid = excluded.provider_verification_sid,
    sent_at = excluded.sent_at,
    expires_at = excluded.expires_at,
    verified_at = null;

  update public.booking_sessions
  set customer_id = null
  where id = target_session.id;

  return query
  select verification.status,
    verification.incorrect_attempts,
    verification.phone_e164,
    verification.expires_at,
    sessions.version
  from public.booking_phone_verifications as verification
  join public.booking_sessions as sessions on sessions.id = verification.booking_session_id
  where verification.booking_session_id = target_session.id;
end;
$$;

create or replace function public.record_booking_phone_verification_check(
  target_access_token_hash bytea,
  expected_version bigint,
  target_provider_verification_sid text,
  request_key text,
  target_provider_status text,
  target_checked_at timestamptz
)
returns table (
  status public.phone_verification_status,
  incorrect_attempts smallint,
  phone_e164 text,
  expires_at timestamptz,
  session_version bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.booking_sessions%rowtype;
  verification public.booking_phone_verifications%rowtype;
  promoted_customer_id uuid;
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

  select * into verification
  from public.booking_phone_verifications
  where booking_session_id = target_session.id
  for update;

  if not found then
    raise exception 'Phone verification not found' using errcode = 'P0002';
  end if;
  if verification.provider_verification_sid <> target_provider_verification_sid then
    raise exception 'Stale phone verification challenge' using errcode = '40001';
  end if;
  if request_key = any(verification.attempt_keys) then
    return query
    select verification.status, verification.incorrect_attempts,
      verification.phone_e164, verification.expires_at, target_session.version;
    return;
  end if;
  if verification.status <> 'pending' then
    raise exception 'Phone verification is no longer pending' using errcode = '23514';
  end if;

  if target_checked_at >= verification.expires_at
    or target_provider_status in ('expired', 'canceled')
  then
    update public.booking_phone_verifications
    set status = 'expired', verified_at = null
    where booking_session_id = target_session.id;
  elsif target_provider_status = 'approved' then
    update public.booking_phone_verifications
    set
      status = 'verified',
      attempt_keys = array_append(attempt_keys, request_key),
      verified_at = target_checked_at
    where booking_session_id = target_session.id;

    insert into public.customers (
      full_name,
      phone_e164,
      phone_verified_at,
      sms_consent,
      sms_consent_at
    ) values (
      verification.full_name,
      verification.phone_e164,
      target_checked_at,
      true,
      verification.sent_at
    )
    on conflict (phone_e164) do update set
      phone_verified_at = greatest(public.customers.phone_verified_at, excluded.phone_verified_at),
      sms_consent = true,
      sms_consent_at = excluded.sms_consent_at,
      updated_at = now()
    returning id into promoted_customer_id;

    update public.booking_sessions
    set customer_id = promoted_customer_id
    where id = target_session.id;
  else
    update public.booking_phone_verifications as current_verification
    set
      incorrect_attempts = current_verification.incorrect_attempts + 1,
      attempt_keys = array_append(current_verification.attempt_keys, request_key),
      status = case
        when current_verification.incorrect_attempts + 1 >= 3
          then 'failed'::public.phone_verification_status
        else 'pending'::public.phone_verification_status
      end
    where current_verification.booking_session_id = target_session.id
      and current_verification.incorrect_attempts < 3;

    update public.booking_sessions set updated_at = now() where id = target_session.id;
  end if;

  return query
  select current_verification.status,
    current_verification.incorrect_attempts,
    current_verification.phone_e164,
    current_verification.expires_at,
    sessions.version
  from public.booking_phone_verifications as current_verification
  join public.booking_sessions as sessions on sessions.id = current_verification.booking_session_id
  where current_verification.booking_session_id = target_session.id;
end;
$$;

create or replace function public.load_booking_phone_verification(
  target_access_token_hash bytea
)
returns table (
  status public.phone_verification_status,
  incorrect_attempts smallint,
  phone_e164 text,
  full_name text,
  sms_consent boolean,
  expires_at timestamptz,
  verified_at timestamptz,
  session_version bigint,
  provider_verification_sid text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session_id uuid;
begin
  select id into target_session_id
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and completed_at is null
    and expires_at > now();

  if not found then
    raise exception 'Active booking session not found' using errcode = 'P0002';
  end if;

  update public.booking_phone_verifications as verification
  set status = 'expired', verified_at = null
  where verification.booking_session_id = target_session_id
    and verification.status = 'pending'
    and verification.expires_at <= now();

  return query
  select verification.status,
    verification.incorrect_attempts,
    verification.phone_e164,
    verification.full_name,
    verification.sms_consent,
    verification.expires_at,
    verification.verified_at,
    sessions.version,
    verification.provider_verification_sid
  from public.booking_phone_verifications as verification
  join public.booking_sessions as sessions on sessions.id = verification.booking_session_id
  where verification.booking_session_id = target_session_id;
end;
$$;

create or replace function public.invalidate_booking_phone_verification(
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

  delete from public.booking_phone_verifications
  where booking_session_id = target_session.id;
  update public.booking_sessions set customer_id = null where id = target_session.id;

  return (select version from public.booking_sessions where id = target_session.id);
end;
$$;

revoke all on function public.start_booking_phone_verification(bytea, bigint, text, text, text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.record_booking_phone_verification_check(bytea, bigint, text, text, text, timestamptz)
  from public, anon, authenticated;
revoke all on function public.load_booking_phone_verification(bytea)
  from public, anon, authenticated;
revoke all on function public.invalidate_booking_phone_verification(bytea, bigint)
  from public, anon, authenticated;

grant execute on function public.start_booking_phone_verification(bytea, bigint, text, text, text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.record_booking_phone_verification_check(bytea, bigint, text, text, text, timestamptz)
  to service_role;
grant execute on function public.load_booking_phone_verification(bytea) to service_role;
grant execute on function public.invalidate_booking_phone_verification(bytea, bigint) to service_role;

comment on table public.booking_phone_verifications is
  'Authoritative server-only Twilio Verify state. OTP values are never stored.';

commit;
