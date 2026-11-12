ALTER TABLE public.ic_outbound_message_drafts DROP CONSTRAINT IF EXISTS ic_outbound_drafts_thread_fk;
ALTER TABLE public.ic_outbound_message_drafts
  ADD CONSTRAINT ic_outbound_drafts_thread_fk
  FOREIGN KEY (organization_id,thread_id)
  REFERENCES public.ic_inbox_threads(organization_id,id) ON DELETE CASCADE;