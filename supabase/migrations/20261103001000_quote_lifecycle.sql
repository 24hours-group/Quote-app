begin;

alter table public.quotes
  drop constraint if exists quotes_acceptance_check;
alter table public.quotes
  add constraint quotes_acceptance_check check (
    (
      status = 'accepted'
      and accepted_at is not null
      and accepted_at between created_at and valid_until
    )
    or (
      status = 'expired'
      and (
        accepted_at is null
        or accepted_at between created_at and valid_until
      )
    )
    or (
      status not in ('accepted', 'expired')
      and accepted_at is null
    )
  );

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
      or (old.status = 'offered' and new.status in (
        'offered', 'accepted', 'expired', 'declined', 'superseded', 'cancelled'
      ))
      or (old.status = 'accepted' and new.status in ('accepted', 'expired'))
      or (old.status = new.status and old.status in (
        'expired', 'declined', 'superseded', 'cancelled'
      ))
    )
    then
      raise exception 'Invalid quote status transition from % to %', old.status, new.status
        using errcode = '23514';
    end if;

    if old.status = 'accepted'
      and new.status = 'accepted'
      and new.accepted_at is distinct from old.accepted_at
    then
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

create or replace function public.audit_quote_status_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (
      actor_role, action, entity_table, entity_id, old_values, new_values
    ) values (
      coalesce(
        nullif(current_setting('app.audit_actor_role', true), ''),
        nullif(current_setting('request.jwt.claim.role', true), ''),
        session_user::text
      ),
      'quote.' || new.status::text,
      'quotes',
      new.id,
      jsonb_build_object(
        'status', old.status,
        'accepted_at', old.accepted_at
      ),
      jsonb_build_object(
        'status', new.status,
        'accepted_at', new.accepted_at
      )
    );
  end if;
  return new;
end;
$$;

create trigger audit_quote_status_transition
  after update of status on public.quotes
  for each row execute function public.audit_quote_status_transition();

create or replace function public.expire_authoritative_quotes(
  target_access_token_hash bytea
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session_id uuid;
  expired_count integer;
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
  then
    raise exception 'Invalid booking session token hash' using errcode = '22023';
  end if;

  select id into target_session_id
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and completed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Active booking session not found' using errcode = 'P0002';
  end if;

  perform set_config('app.audit_actor_role', 'quote_expiration', true);

  update public.quotes as quote
  set status = 'expired'
  where quote.booking_session_id = target_session_id
    and quote.status in ('offered', 'accepted')
    and quote.valid_until <= now()
    and (
      quote.status = 'offered'
      or not exists (
        select 1 from public.payments
        where payments.quote_id = quote.id
          and payments.status in (
            'pending', 'processing', 'requires_action', 'succeeded',
            'partially_refunded', 'refunded'
          )
      )
    );
  get diagnostics expired_count = row_count;

  return expired_count;
end;
$$;

create or replace function public.transition_authoritative_quote(
  target_access_token_hash bytea,
  target_quote_id uuid,
  target_action text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session_id uuid;
  target_quote public.quotes%rowtype;
  next_status public.quote_status;
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or target_quote_id is null
    or target_action not in ('load', 'accept', 'decline', 'supersede')
  then
    raise exception 'Invalid quote lifecycle input' using errcode = '22023';
  end if;

  select id into target_session_id
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and completed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Active booking session not found' using errcode = 'P0002';
  end if;

  select * into target_quote
  from public.quotes
  where id = target_quote_id
    and booking_session_id = target_session_id
  for update;

  if not found then
    raise exception 'Quote not found for booking session' using errcode = 'P0002';
  end if;

  if target_action = 'load' then
    return target_quote.id;
  end if;

  perform set_config('app.audit_actor_role', 'customer_session', true);

  if target_quote.status in ('offered', 'accepted')
    and target_quote.valid_until <= now()
    and (
      target_quote.status = 'offered'
      or not exists (
        select 1 from public.payments
        where quote_id = target_quote.id
          and status in (
            'pending', 'processing', 'requires_action', 'succeeded',
            'partially_refunded', 'refunded'
          )
      )
    )
  then
    update public.quotes set status = 'expired' where id = target_quote.id;
    return target_quote.id;
  end if;

  if (target_action = 'accept' and target_quote.status = 'accepted')
    or (target_action = 'decline' and target_quote.status = 'declined')
    or (target_action = 'supersede' and target_quote.status = 'superseded')
  then
    return target_quote.id;
  end if;

  if target_quote.status <> 'offered' then
    raise exception 'Quote is no longer active' using errcode = 'P0004';
  end if;

  next_status := case target_action
    when 'accept' then 'accepted'::public.quote_status
    when 'decline' then 'declined'::public.quote_status
    when 'supersede' then 'superseded'::public.quote_status
  end;

  update public.quotes
  set
    status = next_status,
    accepted_at = case when next_status = 'accepted' then now() else null end
  where id = target_quote.id;

  return target_quote.id;
end;
$$;

create or replace function public.create_authoritative_quote_revision(
  target_access_token_hash bytea,
  target_expected_version bigint,
  target_base_fingerprint bytea,
  target_snapshot jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session_id uuid;
  existing_quote_id uuid;
  existing_quote_status public.quote_status;
  revision_fingerprint bytea;
begin
  if target_access_token_hash is null
    or octet_length(target_access_token_hash) <> 32
    or target_base_fingerprint is null
    or octet_length(target_base_fingerprint) <> 32
  then
    raise exception 'Invalid quote revision input' using errcode = '22023';
  end if;

  select id into target_session_id
  from public.booking_sessions
  where access_token_hash = target_access_token_hash
    and completed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'Active booking session not found' using errcode = 'P0002';
  end if;

  revision_fingerprint := target_base_fingerprint;
  perform set_config('app.audit_actor_role', 'customer_session', true);

  loop
    existing_quote_id := null;
    existing_quote_status := null;
    select id, status
    into existing_quote_id, existing_quote_status
    from public.quotes
    where booking_session_id = target_session_id
      and request_fingerprint = revision_fingerprint;

    if existing_quote_id is null
      or existing_quote_status in ('draft', 'offered', 'accepted')
    then
      return public.create_authoritative_quote(
        target_access_token_hash,
        target_expected_version,
        revision_fingerprint,
        target_snapshot
      );
    end if;

    revision_fingerprint := extensions.digest(
      revision_fingerprint
      || convert_to(
        ':' || existing_quote_id::text || ':' || existing_quote_status::text,
        'UTF8'
      ),
      'sha256'
    );
  end loop;
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
  target_session_id uuid;
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

  select booking_session_id into target_session_id
  from public.quotes
  where id = target_quote_id;

  if not found then
    raise exception 'Quote not found' using errcode = 'P0002';
  end if;

  perform 1 from public.booking_sessions
  where id = target_session_id
  for update;

  select * into target_quote
  from public.quotes
  where id = target_quote_id
    and booking_session_id = target_session_id
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

revoke all on function public.audit_quote_status_transition()
  from public, anon, authenticated;
revoke all on function public.expire_authoritative_quotes(bytea)
  from public, anon, authenticated;
revoke all on function public.transition_authoritative_quote(bytea, uuid, text)
  from public, anon, authenticated;
revoke all on function public.create_authoritative_quote_revision(bytea, bigint, bytea, jsonb)
  from public, anon, authenticated;
grant execute on function public.expire_authoritative_quotes(bytea)
  to service_role;
grant execute on function public.transition_authoritative_quote(bytea, uuid, text)
  to service_role;
grant execute on function public.create_authoritative_quote_revision(bytea, bigint, bytea, jsonb)
  to service_role;

comment on function public.transition_authoritative_quote(bytea, uuid, text) is
  'Applies idempotent, session-authorized quote load, acceptance, decline, and supersede transitions.';

commit;
