begin;

alter table public.booking_sessions
  add column draft_payload jsonb not null default '{}'::jsonb,
  add column draft_schema_version integer not null default 2,
  add column version bigint not null default 0,
  add column flow_request_type text,
  add constraint booking_sessions_draft_payload_object_check
    check (jsonb_typeof(draft_payload) = 'object'),
  add constraint booking_sessions_draft_schema_version_check
    check (draft_schema_version > 0),
  add constraint booking_sessions_version_check
    check (version >= 0),
  add constraint booking_sessions_flow_request_type_check
    check (flow_request_type is null or flow_request_type in ('new', 'existing', 'cancel')),
  add constraint booking_sessions_access_token_hash_length_check
    check (access_token_hash is null or octet_length(access_token_hash) = 32) not valid;

alter table public.booking_sessions
  validate constraint booking_sessions_access_token_hash_length_check;

alter table public.booking_sessions
  drop constraint booking_sessions_current_screen_check;

alter table public.booking_sessions
  add constraint booking_sessions_current_screen_check check (
    current_screen in (
      'S0', 'S1', 'S2', 'S4', 'S5', 'S6', 'J1', 'T1', 'L1',
      'W1', 'W2', 'G1', 'M1', 'X1', 'S7', 'S8A', 'R',
      'service', 'location', 'vehicle', 'details', 'contact', 'review',
      'payment', 'complete', 'handoff'
    )
  );

create or replace function public.increment_booking_session_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  return new;
end;
$$;

revoke all on function public.increment_booking_session_version()
  from public, anon, authenticated;

create trigger booking_sessions_increment_version
  before update on public.booking_sessions
  for each row execute function public.increment_booking_session_version();

create or replace function public.load_booking_draft(
  target_access_token_hash bytea
)
returns table (
  booking_session_id uuid,
  customer_id uuid,
  current_screen text,
  progress_percent smallint,
  flow_request_type text,
  draft_payload jsonb,
  draft_schema_version integer,
  version bigint,
  expires_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    sessions.id,
    sessions.customer_id,
    sessions.current_screen,
    sessions.progress_percent,
    sessions.flow_request_type,
    sessions.draft_payload,
    sessions.draft_schema_version,
    sessions.version,
    sessions.expires_at,
    sessions.updated_at
  from public.booking_sessions as sessions
  where sessions.access_token_hash = target_access_token_hash
    and sessions.completed_at is null
    and sessions.expires_at > now();
$$;

create or replace function public.save_booking_draft(
  target_access_token_hash bytea,
  expected_version bigint,
  target_draft_schema_version integer,
  target_current_screen text,
  target_progress_percent smallint,
  target_flow_request_type text,
  target_draft_payload jsonb
)
returns table (
  booking_session_id uuid,
  customer_id uuid,
  current_screen text,
  progress_percent smallint,
  flow_request_type text,
  draft_payload jsonb,
  draft_schema_version integer,
  version bigint,
  expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or expected_version < 0
    or target_draft_schema_version < 1
    or target_draft_payload is null
    or jsonb_typeof(target_draft_payload) <> 'object'
    or target_flow_request_type not in ('new', 'existing', 'cancel')
      and target_flow_request_type is not null
  then
    raise exception 'Invalid booking draft input' using errcode = '22023';
  end if;

  return query
  update public.booking_sessions as sessions
  set
    current_screen = target_current_screen,
    progress_percent = target_progress_percent,
    flow_request_type = target_flow_request_type,
    draft_payload = target_draft_payload,
    draft_schema_version = target_draft_schema_version
  where sessions.access_token_hash = target_access_token_hash
    and sessions.completed_at is null
    and sessions.expires_at > now()
    and sessions.version = expected_version
  returning
    sessions.id,
    sessions.customer_id,
    sessions.current_screen,
    sessions.progress_percent,
    sessions.flow_request_type,
    sessions.draft_payload,
    sessions.draft_schema_version,
    sessions.version,
    sessions.expires_at,
    sessions.updated_at;

  if found then
    return;
  end if;

  if exists (
    select 1
    from public.booking_sessions as sessions
    where sessions.access_token_hash = target_access_token_hash
      and sessions.completed_at is null
      and sessions.expires_at > now()
  ) then
    raise exception 'Booking draft version conflict' using errcode = '40001';
  end if;

  raise exception 'Active booking session not found' using errcode = 'P0002';
end;
$$;

create or replace function public.revoke_booking_draft(
  target_access_token_hash bytea,
  expected_version bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  revoked boolean;
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or expected_version < 0
  then
    raise exception 'Invalid booking draft input' using errcode = '22023';
  end if;

  update public.booking_sessions as sessions
  set completed_at = now(), draft_payload = '{}'::jsonb
  where sessions.access_token_hash = target_access_token_hash
    and sessions.completed_at is null
    and sessions.expires_at > now()
    and sessions.version = expected_version;

  revoked := found;
  if revoked then
    return true;
  end if;

  if exists (
    select 1
    from public.booking_sessions as sessions
    where sessions.access_token_hash = target_access_token_hash
      and sessions.completed_at is null
      and sessions.expires_at > now()
  ) then
    raise exception 'Booking draft version conflict' using errcode = '40001';
  end if;

  return false;
end;
$$;

revoke all on function public.load_booking_draft(bytea)
  from public, anon, authenticated;
revoke all on function public.save_booking_draft(bytea, bigint, integer, text, smallint, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.revoke_booking_draft(bytea, bigint)
  from public, anon, authenticated;

grant execute on function public.load_booking_draft(bytea) to service_role;
grant execute on function public.save_booking_draft(bytea, bigint, integer, text, smallint, text, jsonb)
  to service_role;
grant execute on function public.revoke_booking_draft(bytea, bigint) to service_role;

comment on column public.booking_sessions.draft_payload is
  'Server-mediated partial wizard state. Provider-validated final records are promoted to normalized tables.';
comment on column public.booking_sessions.draft_schema_version is
  'Application schema version for validating persisted wizard state.';
comment on column public.booking_sessions.version is
  'Monotonic optimistic-concurrency version incremented on every session update.';
comment on column public.booking_sessions.flow_request_type is
  'Customer flow request type from S1: new, existing, or cancel.';
comment on function public.load_booking_draft(bytea) is
  'Service-role-only active draft lookup by SHA-256 token hash.';
comment on function public.save_booking_draft(bytea, bigint, integer, text, smallint, text, jsonb) is
  'Service-role-only compare-and-swap update for active booking drafts.';
comment on function public.revoke_booking_draft(bytea, bigint) is
  'Service-role-only compare-and-swap revocation for an active booking draft.';

commit;
