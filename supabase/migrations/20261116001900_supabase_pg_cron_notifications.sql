-- Migration: 20261116001900_supabase_pg_cron_notifications.sql
-- Enables pg_cron and pg_net in Supabase to run notification delivery every minute.
-- Replaces Vercel Hobby plan cron limitations.

begin;

-- Enable extensions required for scheduled HTTP calls
create extension if not exists pg_net;
create extension if not exists pg_cron;

-- Grant usage on cron schema
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- Helper to manually trigger the notification worker from SQL
create or replace function public.invoke_notification_worker(
  target_app_url text,
  target_worker_secret text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id bigint;
  clean_url text;
begin
  if target_app_url is null or trim(target_app_url) = '' then
    raise exception 'Target application URL is required' using errcode = '22023';
  end if;

  if target_worker_secret is null or length(trim(target_worker_secret)) < 32 then
    raise exception 'Worker secret must be at least 32 characters' using errcode = '22023';
  end if;

  clean_url := rtrim(trim(target_app_url), '/') || '/api/internal/notifications/process';

  select net.http_post(
    url := clean_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || trim(target_worker_secret)
    ),
    body := '{}'::jsonb
  ) into request_id;

  return request_id;
end;
$$;

-- Helper to schedule or update the notification worker cron job to run every minute
create or replace function public.schedule_notification_worker(
  target_app_url text,
  target_worker_secret text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_id bigint;
  clean_url text;
  cron_cmd text;
begin
  if target_app_url is null or trim(target_app_url) = '' then
    raise exception 'Target application URL is required' using errcode = '22023';
  end if;

  if target_worker_secret is null or length(trim(target_worker_secret)) < 32 then
    raise exception 'Worker secret must be at least 32 characters' using errcode = '22023';
  end if;

  clean_url := rtrim(trim(target_app_url), '/') || '/api/internal/notifications/process';

  -- Remove existing job if already scheduled
  if exists (select 1 from cron.job where jobname = 'process-notifications-every-minute') then
    perform cron.unschedule('process-notifications-every-minute');
  end if;

  cron_cmd := format(
    $cmd$
    select net.http_post(
      url := %L,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || %L
      ),
      body := '{}'::jsonb
    );
    $cmd$,
    clean_url,
    trim(target_worker_secret)
  );

  job_id := cron.schedule(
    'process-notifications-every-minute',
    '* * * * *',
    cron_cmd
  );

  return job_id;
end;
$$;

-- Helper to unschedule the worker cron job
create or replace function public.unschedule_notification_worker()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from cron.job where jobname = 'process-notifications-every-minute') then
    perform cron.unschedule('process-notifications-every-minute');
    return true;
  end if;
  return false;
end;
$$;

commit;
