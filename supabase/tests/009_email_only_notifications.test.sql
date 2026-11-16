begin;

create extension if not exists pgtap with schema extensions;
select plan(4);

select has_trigger(
  'public',
  'dispatch_notifications',
  'dispatch_notifications_reject_sms',
  'dispatch outbox rejects future SMS records'
);

select ok(
  not exists (
    select 1
    from public.application_settings
    where messages ? 'sms_updates_enabled'
  ),
  'application settings no longer advertise SMS updates'
);

select ok(
  not exists (
    select 1
    from public.customers
    where sms_consent or sms_consent_at is not null
  ),
  'customer SMS consent is disabled'
);

select throws_ok(
  $$
    insert into public.dispatch_notifications (
      booking_id,
      event_name,
      channel,
      recipient,
      idempotency_key
    ) values (
      '79000000-0000-4000-8000-000000000001',
      'booking.paid.customer_sms',
      'sms',
      '+12125550100',
      'customer:sms:disabled-test'
    )
  $$,
  '0A000',
  'SMS notification delivery is disabled',
  'new SMS outbox jobs are rejected before delivery'
);

select * from finish();
rollback;
