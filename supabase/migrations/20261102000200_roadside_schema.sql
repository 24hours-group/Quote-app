begin;

create table public.admin_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.admin_role not null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customers (
  id uuid primary key default extensions.gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text not null check (char_length(trim(full_name)) between 1 and 160),
  phone_e164 text not null unique check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  phone_verified_at timestamptz not null,
  sms_consent boolean not null default false,
  sms_consent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_sms_consent_timestamp_check check (
    (sms_consent and sms_consent_at is not null)
    or (not sms_consent and sms_consent_at is null)
  )
);

create table public.booking_sessions (
  id uuid primary key default extensions.gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null,
  access_token_hash bytea unique,
  current_screen text not null default 'service' check (
    current_screen in ('service', 'location', 'vehicle', 'details', 'contact', 'review', 'payment', 'complete', 'handoff')
  ),
  progress_percent smallint not null default 0 check (progress_percent between 0 and 100),
  request_type public.request_type,
  expires_at timestamptz not null default (now() + interval '2 hours'),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_sessions_owner_check check (
    owner_user_id is not null or access_token_hash is not null
  ),
  constraint booking_sessions_expiration_check check (expires_at > created_at),
  constraint booking_sessions_completion_check check (
    completed_at is null or completed_at >= created_at
  )
);

create table public.vehicles (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_session_id uuid not null references public.booking_sessions(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  model_year smallint not null check (model_year between 1900 and 2200),
  make text not null check (char_length(trim(make)) between 1 and 80),
  model text not null check (char_length(trim(model)) between 1 and 100),
  is_heavy_duty boolean not null default false,
  classification text check (classification is null or char_length(trim(classification)) <= 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, booking_session_id)
);

create table public.locations (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_session_id uuid not null references public.booking_sessions(id) on delete cascade,
  kind public.location_kind not null,
  formatted_address text not null check (char_length(trim(formatted_address)) between 5 and 500),
  google_place_id text not null check (char_length(trim(google_place_id)) between 3 and 255),
  latitude numeric(9, 6) not null check (latitude between -90 and 90),
  longitude numeric(9, 6) not null check (longitude between -180 and 180),
  timezone text not null check (public.is_valid_iana_timezone(timezone)),
  is_confirmed boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_session_id, kind),
  unique (id, booking_session_id),
  constraint locations_confirmation_check check (
    (is_confirmed and confirmed_at is not null)
    or (not is_confirmed and confirmed_at is null)
  )
);

create table public.service_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_session_id uuid not null unique references public.booking_sessions(id) on delete cascade,
  vehicle_id uuid not null,
  pickup_location_id uuid not null,
  dropoff_location_id uuid,
  service_type public.service_type not null,
  structured_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(structured_answers) = 'object'),
  customer_notes text check (customer_notes is null or char_length(customer_notes) <= 2000),
  special_flags jsonb not null default '{}'::jsonb check (jsonb_typeof(special_flags) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (vehicle_id, booking_session_id)
    references public.vehicles(id, booking_session_id) on delete restrict,
  foreign key (pickup_location_id, booking_session_id)
    references public.locations(id, booking_session_id) on delete restrict,
  foreign key (dropoff_location_id, booking_session_id)
    references public.locations(id, booking_session_id) on delete restrict,
  unique (id, booking_session_id),
  constraint service_requests_distinct_locations_check check (
    dropoff_location_id is null or dropoff_location_id <> pickup_location_id
  )
);

create table public.route_calculations (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_session_id uuid not null references public.booking_sessions(id) on delete cascade,
  service_request_id uuid not null,
  pickup_location_id uuid not null,
  dropoff_location_id uuid not null,
  route_distance_meters integer not null check (route_distance_meters > 0),
  raw_miles numeric(10, 3) not null check (raw_miles > 0),
  billable_miles numeric(10, 2) not null check (billable_miles >= raw_miles),
  provider text not null default 'google_routes' check (char_length(trim(provider)) between 1 and 50),
  provider_route_token text,
  routing_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(routing_metadata) = 'object'),
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key (service_request_id, booking_session_id)
    references public.service_requests(id, booking_session_id) on delete cascade,
  foreign key (pickup_location_id, booking_session_id)
    references public.locations(id, booking_session_id) on delete restrict,
  foreign key (dropoff_location_id, booking_session_id)
    references public.locations(id, booking_session_id) on delete restrict,
  constraint route_calculations_distinct_locations_check check (
    pickup_location_id <> dropoff_location_id
  )
);

create table public.pricing_parameters (
  id uuid primary key default extensions.gen_random_uuid(),
  parameter_key text not null check (parameter_key ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  value numeric(14, 4) not null check (value >= 0),
  unit text not null check (unit in ('cents', 'cents_per_mile', 'percent', 'miles', 'minutes', 'boolean')),
  version integer not null check (version > 0),
  effective_from timestamptz not null,
  effective_to timestamptz,
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parameter_key, version),
  constraint pricing_parameters_effective_range_check check (
    effective_to is null or effective_to > effective_from
  ),
  constraint pricing_parameters_integer_money_check check (
    unit not in ('cents', 'cents_per_mile') or value = trunc(value)
  )
);

create unique index pricing_parameters_one_active_key_idx
  on public.pricing_parameters (parameter_key)
  where is_active;
create index pricing_parameters_effective_lookup_idx
  on public.pricing_parameters (parameter_key, effective_from desc, effective_to);

create table public.quotes (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_session_id uuid not null references public.booking_sessions(id) on delete restrict,
  service_request_id uuid not null,
  route_calculation_id uuid references public.route_calculations(id) on delete restrict,
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  pricing_version integer not null check (pricing_version > 0),
  pricing_snapshot jsonb not null check (
    jsonb_typeof(pricing_snapshot) = 'object' and pricing_snapshot <> '{}'::jsonb
  ),
  status public.quote_status not null default 'draft',
  valid_until timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (service_request_id, booking_session_id)
    references public.service_requests(id, booking_session_id) on delete restrict,
  constraint quotes_total_check check (total_cents = subtotal_cents + tax_cents),
  constraint quotes_validity_check check (valid_until > created_at),
  constraint quotes_acceptance_check check (
    (
      status = 'accepted'
      and accepted_at is not null
      and accepted_at between created_at and valid_until
    )
    or (status <> 'accepted' and accepted_at is null)
  )
);

create table public.quote_line_items (
  id uuid primary key default extensions.gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  item_code text not null check (item_code ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  description text not null check (char_length(trim(description)) between 1 and 255),
  quantity numeric(10, 3) not null default 1 check (quantity > 0),
  unit_amount_cents integer not null check (unit_amount_cents >= 0),
  total_amount_cents integer not null check (total_amount_cents >= 0),
  sort_order smallint not null default 0 check (sort_order >= 0),
  created_at timestamptz not null default now(),
  unique (quote_id, item_code),
  constraint quote_line_items_total_check check (
    total_amount_cents = round(quantity * unit_amount_cents)::integer
  )
);

create table public.payments (
  id uuid primary key default extensions.gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_payment_id text unique,
  provider_checkout_session_id text unique,
  latest_provider_event_id text unique,
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 255),
  request_fingerprint bytea not null,
  amount_cents integer not null check (amount_cents > 0),
  refunded_amount_cents integer not null default 0 check (
    refunded_amount_cents between 0 and amount_cents
  ),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  status public.payment_status not null default 'pending',
  processed_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, id)
);

create unique index payments_one_active_attempt_per_quote_idx
  on public.payments (quote_id)
  where status in (
    'pending',
    'processing',
    'requires_action',
    'succeeded',
    'partially_refunded',
    'refunded'
  );

create table public.payment_provider_events (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_event_id text not null unique,
  event_type text not null check (char_length(trim(event_type)) between 1 and 120),
  payload_hash bytea not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  processing_error_code text,
  created_at timestamptz not null default now()
);

create table public.payment_refunds (
  id uuid primary key default extensions.gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  provider_refund_id text unique,
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 255),
  amount_cents integer not null check (amount_cents > 0),
  status public.refund_status not null default 'pending',
  reason_code text check (reason_code is null or char_length(reason_code) <= 100),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bookings (
  id uuid primary key default extensions.gen_random_uuid(),
  reference text not null unique default public.generate_booking_reference()
    check (reference ~ '^RS-[A-Z0-9]{8,20}$'),
  customer_id uuid not null references public.customers(id) on delete restrict,
  booking_session_id uuid not null unique references public.booking_sessions(id) on delete restrict,
  service_request_id uuid not null unique references public.service_requests(id) on delete restrict,
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  payment_id uuid unique references public.payments(id) on delete restrict,
  payment_status public.payment_status not null default 'pending',
  dispatch_status public.dispatch_status not null default 'not_ready',
  booked_at timestamptz not null default now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bookings_terminal_timestamp_check check (
    not (completed_at is not null and cancelled_at is not null)
  )
);

create table public.handoff_leads (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_session_id uuid not null references public.booking_sessions(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  collected_details jsonb not null default '{}'::jsonb check (jsonb_typeof(collected_details) = 'object'),
  reason_code text not null check (reason_code ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  assigned_team text check (assigned_team is null or char_length(trim(assigned_team)) <= 100),
  callback_status public.callback_status not null default 'new',
  callback_due_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dispatch_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  event_name text not null check (event_name ~ '^[a-z][a-z0-9_.-]{1,99}$'),
  channel public.notification_channel not null,
  recipient text not null check (char_length(trim(recipient)) between 3 and 320),
  delivery_status public.delivery_status not null default 'pending',
  retry_count smallint not null default 0 check (retry_count between 0 and 20),
  max_attempts smallint not null default 5 check (max_attempts between 1 and 20),
  idempotency_key text not null unique check (char_length(idempotency_key) between 16 and 255),
  provider_message_id text unique,
  next_attempt_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dispatch_notifications_retry_check check (retry_count <= max_attempts),
  unique (booking_id, event_name, channel, recipient)
);

create table public.audit_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role text not null default current_user,
  action text not null check (char_length(trim(action)) between 1 and 100),
  entity_table text not null check (char_length(trim(entity_table)) between 1 and 100),
  entity_id uuid,
  old_values jsonb,
  new_values jsonb,
  request_id uuid,
  ip_address inet,
  created_at timestamptz not null default now(),
  constraint audit_logs_values_check check (
    old_values is not null or new_values is not null
  )
);

create table public.application_settings (
  id uuid primary key default extensions.gen_random_uuid(),
  setting_scope text not null unique default 'default' check (setting_scope ~ '^[a-z][a-z0-9_-]{1,49}$'),
  company_name text not null check (char_length(trim(company_name)) between 1 and 160),
  support_phone_e164 text not null check (support_phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  dispatch_email text not null check (dispatch_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'),
  default_timezone text not null default 'America/New_York' check (public.is_valid_iana_timezone(default_timezone)),
  messages jsonb not null default '{}'::jsonb check (jsonb_typeof(messages) = 'object'),
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_auth_user_idx on public.customers (auth_user_id) where auth_user_id is not null;
create index booking_sessions_customer_idx on public.booking_sessions (customer_id);
create index booking_sessions_owner_idx on public.booking_sessions (owner_user_id) where owner_user_id is not null;
create index booking_sessions_expiration_idx on public.booking_sessions (expires_at) where completed_at is null;
create index vehicles_customer_idx on public.vehicles (customer_id) where customer_id is not null;
create index locations_place_id_idx on public.locations (google_place_id);
create index service_requests_type_idx on public.service_requests (service_type, created_at desc);
create index route_calculations_request_idx on public.route_calculations (service_request_id, calculated_at desc);
create index quotes_session_idx on public.quotes (booking_session_id, created_at desc);
create index quotes_validity_idx on public.quotes (status, valid_until);
create index payments_quote_idx on public.payments (quote_id, created_at desc);
create index payments_status_idx on public.payments (status, updated_at desc);
create index payment_provider_events_payment_idx
  on public.payment_provider_events (payment_id, received_at desc);
create index payment_provider_events_unprocessed_idx
  on public.payment_provider_events (received_at)
  where processed_at is null;
create index payment_refunds_payment_idx on public.payment_refunds (payment_id, created_at desc);
create index bookings_customer_idx on public.bookings (customer_id, booked_at desc);
create index bookings_dispatch_idx on public.bookings (dispatch_status, booked_at);
create index handoff_leads_queue_idx on public.handoff_leads (callback_status, callback_due_at);
create index dispatch_notifications_queue_idx on public.dispatch_notifications (delivery_status, next_attempt_at, created_at);
create index dispatch_notifications_booking_idx on public.dispatch_notifications (booking_id, event_name);
create index audit_logs_entity_idx on public.audit_logs (entity_table, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_user_id, created_at desc) where actor_user_id is not null;

commit;
