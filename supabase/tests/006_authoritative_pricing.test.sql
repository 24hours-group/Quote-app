begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

select has_column('public', 'quotes', 'priced_at', 'quotes store exact pricing time');
select has_column('public', 'quotes', 'pricing_timezone', 'quotes store pricing timezone');
select has_column('public', 'quotes', 'request_fingerprint', 'quotes support idempotent generation');
select has_column('public', 'quote_line_items', 'payable_now', 'line items distinguish payable-now charges');
select has_column('public', 'quote_line_items', 'confirmation_required', 'line items distinguish confirmed-later charges');
select has_column('public', 'quote_line_items', 'metadata', 'line items store immutable charge metadata');
select has_index('public', 'quotes', 'quotes_one_accepted_session_idx', 'only one accepted quote is allowed per session');
select has_trigger(
  'public',
  'quotes',
  'audit_quote_status_transition',
  'every quote lifecycle transition is audited'
);
select enum_has_labels(
  'public',
  'quote_status',
  array['draft', 'offered', 'accepted', 'expired', 'declined', 'superseded', 'cancelled'],
  'quote lifecycle includes a distinct declined state'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_authoritative_quote(bytea,bigint,bytea,jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot create quotes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_authoritative_quote(bytea,bigint,bytea,jsonb)',
    'EXECUTE'
  ),
  'authenticated users cannot bypass the quote API'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_authoritative_quote(bytea,bigint,bytea,jsonb)',
    'EXECUTE'
  ),
  'service role can create authoritative quotes'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.transition_authoritative_quote(bytea,uuid,text)',
    'EXECUTE'
  ),
  'anonymous users cannot transition quotes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.transition_authoritative_quote(bytea,uuid,text)',
    'EXECUTE'
  ),
  'authenticated users cannot bypass quote lifecycle authorization'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.transition_authoritative_quote(bytea,uuid,text)',
    'EXECUTE'
  ),
  'service role can transition authorized quotes'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.expire_authoritative_quotes(bytea)',
    'EXECUTE'
  ),
  'anonymous users cannot expire quotes'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.expire_authoritative_quotes(bytea)',
    'EXECUTE'
  ),
  'authenticated users cannot expire quotes directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.expire_authoritative_quotes(bytea)',
    'EXECUTE'
  ),
  'service role can expire authorized quotes'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.create_authoritative_quote_revision(bytea,bigint,bytea,jsonb)',
    'EXECUTE'
  ),
  'anonymous users cannot allocate quote revisions'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'public.create_authoritative_quote_revision(bytea,bigint,bytea,jsonb)',
    'EXECUTE'
  ),
  'authenticated users cannot allocate quote revisions directly'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.create_authoritative_quote_revision(bytea,bigint,bytea,jsonb)',
    'EXECUTE'
  ),
  'service role can allocate session-authorized quote revisions'
);

select is(
  (select count(distinct version)::integer from public.pricing_parameters where is_active),
  1,
  'all active pricing parameters share one version'
);
select is(
  (select value::integer from public.pricing_parameters where parameter_key = 'quote_valid_min' and is_active),
  30,
  'quotes remain valid for 30 minutes'
);
select is(
  (select count(*)::integer from public.pricing_parameters where is_active),
  30,
  'the complete page-3 pricing key set is active'
);

select * from finish();
rollback;
