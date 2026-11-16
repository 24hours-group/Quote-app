begin;

alter table public.handoff_leads
  add constraint handoff_leads_callback_contact_check
  check (requested_action <> 'request_callback' or customer_id is not null)
  not valid;

comment on constraint handoff_leads_callback_contact_check on public.handoff_leads is
  'New callback requests require a server-attached customer contact. The constraint is initially not valid so legacy contactless leads remain readable.';

commit;
