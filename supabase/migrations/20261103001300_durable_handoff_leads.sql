begin;

alter table public.handoff_leads
  drop constraint if exists handoff_leads_reason_code_check;

update public.handoff_leads
set reason_code = 'USER_REQUEST'
where reason_code not in (
  'USER_REQUEST', 'EXISTING_JOB', 'CANCEL_JOB', 'MISSING_INFO',
  'HEAVY_DUTY', 'UNLISTED_SERVICE', 'WINCH_SPECIALIST', 'OVER_LIMIT',
  'PAY_BY_PHONE'
);

update public.handoff_leads
set assigned_team = case reason_code
  when 'EXISTING_JOB' then 'Job owner'
  when 'CANCEL_JOB' then 'Job owner'
  when 'HEAVY_DUTY' then 'Heavy-duty team'
  when 'UNLISTED_SERVICE' then 'Specialist'
  when 'WINCH_SPECIALIST' then 'Specialist'
  else 'Dispatcher'
end
where assigned_team is null;

alter table public.handoff_leads
  alter column assigned_team set not null,
  add column priority text not null default 'normal',
  add column payment_classification text not null default 'unpaid',
  add column requested_action text not null default 'request_callback',
  add column idempotency_key text,
  add column contacted_at timestamptz,
  add column follow_up_at timestamptz,
  add column closed_at timestamptz;

update public.handoff_leads
set idempotency_key = 'handoff:legacy:' || id::text
where idempotency_key is null;

alter table public.handoff_leads
  alter column idempotency_key set not null,
  add constraint handoff_leads_reason_code_check check (reason_code in (
    'USER_REQUEST', 'EXISTING_JOB', 'CANCEL_JOB', 'MISSING_INFO',
    'HEAVY_DUTY', 'UNLISTED_SERVICE', 'WINCH_SPECIALIST', 'OVER_LIMIT',
    'PAY_BY_PHONE'
  )),
  add constraint handoff_leads_priority_check
    check (priority in ('normal', 'high', 'urgent')),
  add constraint handoff_leads_payment_classification_check
    check (payment_classification in ('paid', 'unpaid')),
  add constraint handoff_leads_requested_action_check
    check (requested_action in ('request_callback', 'call_now')),
  add constraint handoff_leads_idempotency_key_key unique (idempotency_key),
  add constraint handoff_leads_callback_dates_check check (
    (callback_status <> 'contacted' or contacted_at is not null)
    and (callback_status not in ('resolved', 'closed') or resolved_at is not null)
    and (callback_status <> 'closed' or closed_at is not null)
  );

create index handoff_leads_team_follow_up_idx
  on public.handoff_leads (assigned_team, callback_status, follow_up_at, created_at);
create index handoff_leads_payment_idx
  on public.handoff_leads (payment_classification, created_at desc);

alter table public.dispatch_notifications
  drop constraint if exists dispatch_notifications_booking_id_event_name_channel_recipient_key;

alter table public.dispatch_notifications
  alter column booking_id drop not null,
  add column handoff_lead_id uuid references public.handoff_leads(id) on delete cascade;

alter table public.dispatch_notifications
  add constraint dispatch_notifications_exactly_one_source_check check (
    (booking_id is not null and handoff_lead_id is null)
    or (booking_id is null and handoff_lead_id is not null)
  );

create unique index dispatch_notifications_booking_event_recipient_uidx
  on public.dispatch_notifications (booking_id, event_name, channel, recipient)
  where booking_id is not null;
create unique index dispatch_notifications_handoff_event_recipient_uidx
  on public.dispatch_notifications (handoff_lead_id, event_name, channel, recipient)
  where handoff_lead_id is not null;
create index dispatch_notifications_handoff_idx
  on public.dispatch_notifications (handoff_lead_id, event_name)
  where handoff_lead_id is not null;

create or replace function public.protect_dispatch_identity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.booking_id is distinct from old.booking_id
    or new.handoff_lead_id is distinct from old.handoff_lead_id
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

create or replace function public.create_handoff_lead_by_session(
  target_access_token_hash bytea,
  target_reason_code text,
  target_action text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_session public.booking_sessions%rowtype;
  target_customer public.customers%rowtype;
  target_settings public.application_settings%rowtype;
  target_lead public.handoff_leads%rowtype;
  target_booking public.bookings%rowtype;
  target_vehicle public.vehicles%rowtype;
  target_pickup public.locations%rowtype;
  target_dropoff public.locations%rowtype;
  target_request public.service_requests%rowtype;
  target_route public.route_calculations%rowtype;
  target_payment public.payments%rowtype;
  draft_answers jsonb;
  service_answers jsonb;
  collected jsonb;
  team_name text;
  team_key text;
  selected_priority text;
  selected_payment_classification text;
  selected_recipient text;
  request_key text;
begin
  if target_access_token_hash is null or octet_length(target_access_token_hash) <> 32
    or target_reason_code not in (
      'USER_REQUEST', 'EXISTING_JOB', 'CANCEL_JOB', 'MISSING_INFO',
      'HEAVY_DUTY', 'UNLISTED_SERVICE', 'WINCH_SPECIALIST', 'OVER_LIMIT',
      'PAY_BY_PHONE'
    )
    or target_action not in ('request_callback', 'call_now')
  then
    raise exception 'Invalid hand-off request' using errcode = '22023';
  end if;

  if target_reason_code = 'WINCH_SPECIALIST' and target_action <> 'request_callback' then
    raise exception 'Winch specialist requests are callback-only' using errcode = '23514';
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

  select * into target_settings
  from public.application_settings
  where setting_scope = 'default';
  if not found or target_settings.dispatch_email is null then
    raise exception 'Hand-off routing is not configured' using errcode = 'P0002';
  end if;

  team_name := case target_reason_code
    when 'EXISTING_JOB' then 'Job owner'
    when 'CANCEL_JOB' then 'Job owner'
    when 'HEAVY_DUTY' then 'Heavy-duty team'
    when 'UNLISTED_SERVICE' then 'Specialist'
    when 'WINCH_SPECIALIST' then 'Specialist'
    else 'Dispatcher'
  end;
  team_key := case target_reason_code
    when 'EXISTING_JOB' then 'job_owner'
    when 'CANCEL_JOB' then 'job_owner'
    when 'HEAVY_DUTY' then 'heavy_duty'
    when 'UNLISTED_SERVICE' then 'specialist'
    when 'WINCH_SPECIALIST' then 'specialist'
    else 'dispatcher'
  end;

  draft_answers := coalesce(target_session.draft_payload->'answers', '{}'::jsonb);
  selected_priority := case
    when draft_answers->>'isSafe' = 'false'
      or draft_answers->>'childOrPetInside' = 'true' then 'urgent'
    when target_reason_code in (
      'EXISTING_JOB', 'CANCEL_JOB', 'HEAVY_DUTY', 'UNLISTED_SERVICE',
      'WINCH_SPECIALIST', 'OVER_LIMIT'
    ) then 'high'
    else 'normal'
  end;

  if target_session.customer_id is not null then
    select * into target_customer
    from public.customers
    where id = target_session.customer_id;
  end if;

  select * into target_booking
  from public.bookings
  where booking_session_id = target_session.id
    and payment_status = 'succeeded'
  order by created_at desc
  limit 1;
  selected_payment_classification := case
    when target_booking.id is not null then 'paid'
    else 'unpaid'
  end;

  select * into target_vehicle from public.vehicles
  where booking_session_id = target_session.id order by created_at desc limit 1;
  select * into target_pickup from public.locations
  where booking_session_id = target_session.id and kind = 'pickup' limit 1;
  select * into target_dropoff from public.locations
  where booking_session_id = target_session.id and kind = 'dropoff' limit 1;
  select * into target_request from public.service_requests
  where booking_session_id = target_session.id limit 1;
  if target_request.id is not null then
    select * into target_route from public.route_calculations
    where service_request_id = target_request.id order by calculated_at desc limit 1;
  end if;
  if target_booking.payment_id is not null then
    select * into target_payment from public.payments where id = target_booking.payment_id;
  end if;

  service_answers := case
    when target_request.id is not null then target_request.structured_answers
    else draft_answers - array[
      'fullName', 'receiptEmail', 'mobileNumber', 'textConsent', 'codeStatus',
      'codeAttempts', 'year', 'make', 'model', 'vehicleSize', 'locationAddress',
      'locationLatitude', 'locationLongitude', 'locationTimezone',
      'locationPlaceId', 'locationResolutionId', 'quoteId', 'quoteAction',
      'paymentStatus', 'handoffReason', 'handoffFrom', 'editReturnTo'
    ]
  end;

  collected := jsonb_strip_nulls(jsonb_build_object(
    'schemaVersion', 1,
    'contact', jsonb_build_object(
      'fullName', coalesce(target_customer.full_name, draft_answers->>'fullName'),
      'phone', coalesce(target_customer.phone_e164, draft_answers->>'mobileNumber'),
      'receiptEmail', coalesce(target_customer.receipt_email, draft_answers->>'receiptEmail'),
      'phoneVerified', coalesce(target_customer.phone_verified_at is not null, false),
      'smsConsent', coalesce(target_customer.sms_consent, (draft_answers->>'textConsent')::boolean, false)
    ),
    'vehicle', jsonb_build_object(
      'year', coalesce(target_vehicle.model_year::text, draft_answers->>'year'),
      'make', coalesce(target_vehicle.make, draft_answers->>'make'),
      'model', coalesce(target_vehicle.model, draft_answers->>'model'),
      'heavyDuty', coalesce(target_vehicle.is_heavy_duty, draft_answers->>'vehicleSize' = 'heavy')
    ),
    'pickup', jsonb_build_object(
      'address', coalesce(target_pickup.formatted_address, draft_answers->>'locationAddress'),
      'latitude', coalesce(target_pickup.latitude::text, draft_answers->>'locationLatitude'),
      'longitude', coalesce(target_pickup.longitude::text, draft_answers->>'locationLongitude'),
      'timezone', coalesce(target_pickup.timezone, draft_answers->>'locationTimezone'),
      'placeId', coalesce(target_pickup.google_place_id, draft_answers->>'locationPlaceId'),
      'landmarks', draft_answers->>'landmarks',
      'confirmed', coalesce(target_pickup.is_confirmed, false)
    ),
    'dropoff', case
      when target_dropoff.id is null and draft_answers->>'dropoffAddress' is null then null
      else jsonb_build_object(
        'address', coalesce(target_dropoff.formatted_address, draft_answers->>'dropoffAddress'),
        'latitude', coalesce(target_dropoff.latitude::text, draft_answers->>'dropoffLatitude'),
        'longitude', coalesce(target_dropoff.longitude::text, draft_answers->>'dropoffLongitude'),
        'placeId', coalesce(target_dropoff.google_place_id, draft_answers->>'dropoffPlaceId')
      )
    end,
    'service', jsonb_build_object(
      'type', coalesce(target_request.service_type::text, draft_answers->>'resolvedServiceType', draft_answers->>'serviceType'),
      'answers', coalesce(service_answers, '{}'::jsonb),
      'notes', coalesce(target_request.customer_notes, draft_answers->>'customerNotes', draft_answers->>'mechanicNotes'),
      'specialFlags', coalesce(target_request.special_flags, '{}'::jsonb)
        || jsonb_strip_nulls(jsonb_build_object(
          'isSafe', draft_answers->'isSafe',
          'childOrPetInside', draft_answers->'childOrPetInside'
        ))
    ),
    'route', case when target_route.id is null then null else jsonb_build_object(
      'distanceMeters', target_route.route_distance_meters,
      'rawMiles', target_route.raw_miles,
      'billableMiles', target_route.billable_miles,
      'calculatedAt', target_route.calculated_at
    ) end,
    'payment', case when selected_payment_classification = 'paid' then jsonb_build_object(
      'classification', 'paid',
      'bookingReference', target_booking.reference,
      'paymentReference', target_payment.provider_payment_id,
      'amountCents', target_payment.amount_cents,
      'currency', target_payment.currency,
      'processedAt', target_payment.processed_at
    ) else jsonb_build_object('classification', 'unpaid') end,
    'requestContext', jsonb_build_object(
      'requestType', coalesce(target_session.flow_request_type, draft_answers->>'requestType'),
      'fromScreen', draft_answers->>'handoffFrom'
    )
  ));

  request_key := 'handoff:' || target_session.id::text || ':' || target_reason_code || ':' || target_action;

  insert into public.handoff_leads (
    booking_session_id, customer_id, collected_details, reason_code,
    assigned_team, callback_status, callback_due_at, priority,
    payment_classification, requested_action, idempotency_key, follow_up_at
  ) values (
    target_session.id, target_session.customer_id, collected, target_reason_code,
    team_name,
    case when target_action = 'request_callback' then 'queued'::public.callback_status else 'new'::public.callback_status end,
    case when target_action = 'request_callback' then now() else null end,
    selected_priority, selected_payment_classification, target_action, request_key,
    case when target_action = 'request_callback' then now() else null end
  )
  on conflict (idempotency_key) do update
    set idempotency_key = excluded.idempotency_key
  returning * into target_lead;

  selected_recipient := coalesce(
    nullif(target_settings.messages #>> array['handoff_team_emails', team_key], ''),
    target_settings.dispatch_email
  );

  insert into public.dispatch_notifications (
    booking_id, handoff_lead_id, event_name, channel, recipient,
    idempotency_key, payload, payload_version, template_key,
    template_version, next_attempt_at
  ) values (
    null, target_lead.id, 'handoff.lead.created', 'email', selected_recipient,
    'handoff:email:' || target_lead.id::text,
    jsonb_build_object(
      'schemaVersion', 1,
      'lead', jsonb_build_object(
        'id', target_lead.id,
        'reasonCode', target_lead.reason_code,
        'assignedTeam', target_lead.assigned_team,
        'priority', target_lead.priority,
        'paymentClassification', target_lead.payment_classification,
        'requestedAction', target_lead.requested_action,
        'callbackStatus', target_lead.callback_status,
        'createdAt', target_lead.created_at
      ),
      'details', target_lead.collected_details,
      'company', jsonb_build_object(
        'name', target_settings.company_name,
        'supportPhone', target_settings.support_phone_e164
      )
    ),
    1, 'operations.handoff_lead', 1, now()
  ) on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'id', target_lead.id,
    'reasonCode', target_lead.reason_code,
    'assignedTeam', target_lead.assigned_team,
    'priority', target_lead.priority,
    'paymentClassification', target_lead.payment_classification,
    'requestedAction', target_lead.requested_action,
    'callbackStatus', target_lead.callback_status,
    'supportPhoneE164', target_settings.support_phone_e164,
    'companyName', target_settings.company_name,
    'createdAt', target_lead.created_at
  );
end;
$$;

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
  if failed_notification.booking_id is not null then
    select reference into target_booking_reference
    from public.bookings where id = failed_notification.booking_id;
  end if;
  alert_event := 'notification.dead-letter.' || failed_notification.id::text;

  insert into public.dispatch_notifications (
    booking_id, handoff_lead_id, event_name, channel, recipient, idempotency_key,
    payload, payload_version, template_key, template_version, next_attempt_at
  ) values (
    failed_notification.booking_id, failed_notification.handoff_lead_id,
    alert_event, 'email', alert_recipient,
    'alert:delivery-dead-letter:' || failed_notification.id::text,
    jsonb_build_object(
      'schemaVersion', 1,
      'sourceNotificationId', failed_notification.id,
      'bookingId', failed_notification.booking_id,
      'handoffLeadId', failed_notification.handoff_lead_id,
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

revoke all on function public.create_handoff_lead_by_session(bytea, text, text)
  from public, anon, authenticated;
grant execute on function public.create_handoff_lead_by_session(bytea, text, text)
  to service_role;

comment on function public.create_handoff_lead_by_session(bytea, text, text) is
  'Authorizes an active booking session, derives sensitive hand-off fields, and atomically enqueues the team notification.';
comment on column public.handoff_leads.payment_classification is
  'Derived from a succeeded server-side booking/payment only; never accepted from the browser.';
comment on column public.handoff_leads.idempotency_key is
  'Stable per booking session, reason, and requested action.';
comment on column public.dispatch_notifications.handoff_lead_id is
  'Identifies a durable hand-off notification when no paid booking exists.';

commit;
