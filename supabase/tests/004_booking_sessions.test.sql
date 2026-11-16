begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

select has_column('public', 'booking_sessions', 'draft_payload', 'sessions store server drafts');
select col_type_is('public', 'booking_sessions', 'draft_payload', 'jsonb', 'draft payload uses jsonb');
select col_type_is('public', 'booking_sessions', 'version', 'bigint', 'sessions have a concurrency version');
select has_column('public', 'booking_sessions', 'flow_request_type', 'sessions preserve the S1 request type');

select has_function('public', 'load_booking_draft', array['bytea'], 'draft load RPC exists');
select has_function(
  'public',
  'save_booking_draft',
  array['bytea', 'bigint', 'integer', 'text', 'smallint', 'text', 'jsonb'],
  'versioned draft save RPC exists'
);
select has_function(
  'public',
  'revoke_booking_draft',
  array['bytea', 'bigint'],
  'versioned draft revocation RPC exists'
);

select ok(
  not has_function_privilege('anon', 'public.load_booking_draft(bytea)', 'EXECUTE'),
  'anonymous users cannot load drafts'
);
select ok(
  not has_function_privilege('authenticated', 'public.load_booking_draft(bytea)', 'EXECUTE'),
  'authenticated users cannot bypass the server to load drafts'
);
select ok(
  has_function_privilege('service_role', 'public.load_booking_draft(bytea)', 'EXECUTE'),
  'service role can load drafts'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.save_booking_draft(bytea,bigint,integer,text,smallint,text,jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot save drafts'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.save_booking_draft(bytea,bigint,integer,text,smallint,text,jsonb)',
    'EXECUTE'
  ),
  'authenticated users cannot bypass the server to save drafts'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.save_booking_draft(bytea,bigint,integer,text,smallint,text,jsonb)',
    'EXECUTE'
  ),
  'service role can save drafts'
);
select ok(
  not has_function_privilege('anon', 'public.revoke_booking_draft(bytea,bigint)', 'EXECUTE'),
  'anonymous users cannot revoke drafts'
);
select ok(
  not has_function_privilege('authenticated', 'public.revoke_booking_draft(bytea,bigint)', 'EXECUTE'),
  'authenticated users cannot bypass the server to revoke drafts'
);
select ok(
  has_function_privilege('service_role', 'public.revoke_booking_draft(bytea,bigint)', 'EXECUTE'),
  'service role can revoke drafts'
);

select throws_ok(
  $$
    insert into public.booking_sessions (access_token_hash, current_screen)
    values ('\x01'::bytea, 'S0')
  $$,
  '23514',
  null,
  'session token hashes must be 32-byte digests'
);

insert into public.booking_sessions (
  id,
  access_token_hash,
  current_screen,
  expires_at
) values (
  '71000000-0000-4000-8000-000000000001',
  extensions.digest('active-draft-token', 'sha256'),
  'S0',
  now() + interval '1 hour'
);

select is(
  (
    select version
    from public.load_booking_draft(extensions.digest('active-draft-token', 'sha256'))
  ),
  0::bigint,
  'a new active draft starts at version zero'
);

select is(
  (
    select version
    from public.save_booking_draft(
      extensions.digest('active-draft-token', 'sha256'),
      0,
      2,
      'S1',
      13,
      'new',
      '{"currentScreenId":"S1","answers":{"isSafe":true,"requestType":"new"},"history":["S0"]}'::jsonb
    )
  ),
  1::bigint,
  'a successful draft save increments the version'
);

select throws_ok(
  $$
    select public.save_booking_draft(
      extensions.digest('active-draft-token', 'sha256'),
      0,
      2,
      'S2',
      25,
      'new',
      '{"stale":true}'::jsonb
    )
  $$,
  '40001',
  null,
  'a stale concurrent save is rejected'
);

select is(
  (
    select draft_payload
    from public.load_booking_draft(extensions.digest('active-draft-token', 'sha256'))
  ),
  '{"currentScreenId":"S1","answers":{"isSafe":true,"requestType":"new"},"history":["S0"]}'::jsonb,
  'a stale save does not overwrite the winning draft'
);

select is(
  (
    select count(*)
    from public.load_booking_draft(extensions.digest('another-customer-token', 'sha256'))
  ),
  0::bigint,
  'a different customer token cannot load the active draft'
);

select throws_ok(
  $$
    select public.save_booking_draft(
      extensions.digest('active-draft-token', 'sha256'),
      1,
      2,
      'NOT_A_SCREEN',
      25,
      'new',
      '{}'::jsonb
    )
  $$,
  '23514',
  null,
  'invalid screen identifiers are rejected'
);

insert into public.booking_sessions (
  id,
  access_token_hash,
  current_screen,
  created_at,
  expires_at
) values (
  '71000000-0000-4000-8000-000000000002',
  extensions.digest('expired-draft-token', 'sha256'),
  'S2',
  now() - interval '2 hours',
  now() - interval '1 hour'
);

select is(
  (
    select count(*)
    from public.load_booking_draft(extensions.digest('expired-draft-token', 'sha256'))
  ),
  0::bigint,
  'expired drafts cannot be loaded'
);

select throws_ok(
  $$
    select public.save_booking_draft(
      extensions.digest('expired-draft-token', 'sha256'),
      0,
      2,
      'S2',
      25,
      'new',
      '{}'::jsonb
    )
  $$,
  'P0002',
  null,
  'expired drafts cannot be saved'
);

select ok(
  public.revoke_booking_draft(
    extensions.digest('active-draft-token', 'sha256'),
    1
  ),
  'the current session owner can revoke an active draft'
);

select is(
  (
    select count(*)
    from public.load_booking_draft(extensions.digest('active-draft-token', 'sha256'))
  ),
  0::bigint,
  'revoked drafts cannot be refreshed'
);

select * from finish();
rollback;
