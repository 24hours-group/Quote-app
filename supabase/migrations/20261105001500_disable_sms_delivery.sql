begin;

update public.customers
set sms_consent = false,
    sms_consent_at = null,
    updated_at = now()
where sms_consent or sms_consent_at is not null;

alter table public.customers
  add constraint customers_sms_delivery_disabled_check
  check (not sms_consent and sms_consent_at is null) not valid;
alter table public.customers
  validate constraint customers_sms_delivery_disabled_check;

update public.application_settings
set messages = messages - 'sms_updates_enabled',
    updated_at = now()
where messages ? 'sms_updates_enabled';

update public.dispatch_notifications
set delivery_status = 'dead_letter',
    next_attempt_at = null,
    delivered_at = null,
    dead_lettered_at = coalesce(dead_lettered_at, now()),
    lease_token = null,
    leased_until = null,
    last_error_code = 'sms_delivery_removed',
    updated_at = now()
where channel = 'sms'
  and delivery_status in ('pending', 'failed', 'processing');

create or replace function public.reject_sms_dispatch_notification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.channel = 'sms' then
    raise exception 'SMS notification delivery is disabled'
      using errcode = '0A000';
  end if;
  return new;
end;
$$;

revoke all on function public.reject_sms_dispatch_notification()
  from public, anon, authenticated, service_role;

create trigger dispatch_notifications_reject_sms
  before insert or update of channel on public.dispatch_notifications
  for each row execute function public.reject_sms_dispatch_notification();

create or replace function public.enqueue_paid_booking_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  customer_record public.customers%rowtype;
  settings_record public.application_settings%rowtype;
begin
  if new.payment_status <> 'succeeded' then return new; end if;

  select * into settings_record
  from public.application_settings
  where setting_scope = 'default';
  select * into customer_record
  from public.customers
  where id = new.customer_id;

  if settings_record.dispatch_email is null then
    raise exception 'Dispatch recipient is not configured' using errcode = 'P0002';
  end if;

  perform public.enqueue_dispatch_notification(
    new.id, 'booking.paid', 'email', settings_record.dispatch_email,
    'dispatch:booking-paid:' || new.id::text
  );

  if customer_record.receipt_email is not null then
    perform public.enqueue_dispatch_notification(
      new.id, 'booking.paid.customer_receipt', 'email', customer_record.receipt_email,
      'customer:email:booking-paid:' || new.id::text
    );
  end if;

  return new;
end;
$$;

comment on function public.reject_sms_dispatch_notification() is
  'Prevents new SMS outbox records; customer and dispatch notifications are email-only.';
comment on constraint customers_sms_delivery_disabled_check on public.customers is
  'SMS delivery and consent collection are disabled for this application.';

commit;
