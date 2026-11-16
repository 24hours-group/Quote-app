begin;

-- Add operational tables to supabase_realtime publication for real-time admin sync
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
    ) then
      alter publication supabase_realtime add table public.bookings;
    end if;

    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'handoff_leads'
    ) then
      alter publication supabase_realtime add table public.handoff_leads;
    end if;

    if not exists (
      select 1 from pg_publication_tables 
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dispatch_notifications'
    ) then
      alter publication supabase_realtime add table public.dispatch_notifications;
    end if;
  end if;
end $$;

commit;

