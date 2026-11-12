GRANT USAGE ON SCHEMA ic_private TO service_role;
CREATE OR REPLACE FUNCTION public.ic_claim_whatsapp_inbox_event()
RETURNS TABLE(event_id uuid, attempts integer)
LANGUAGE sql SECURITY INVOKER
SET search_path = pg_catalog, ic_private
AS $$ SELECT * FROM ic_private.claim_whatsapp_inbox_event(); $$;
CREATE OR REPLACE FUNCTION public.ic_process_whatsapp_inbox_event(p_event_id uuid)
RETURNS jsonb
LANGUAGE sql SECURITY INVOKER
SET search_path = pg_catalog, ic_private
AS $$ SELECT ic_private.process_whatsapp_inbox_event(p_event_id); $$;
REVOKE ALL ON FUNCTION public.ic_claim_whatsapp_inbox_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ic_process_whatsapp_inbox_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ic_claim_whatsapp_inbox_event() TO service_role;
GRANT EXECUTE ON FUNCTION public.ic_process_whatsapp_inbox_event(uuid) TO service_role;
