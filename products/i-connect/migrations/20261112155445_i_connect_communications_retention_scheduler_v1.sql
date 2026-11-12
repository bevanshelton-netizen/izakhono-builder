CREATE OR REPLACE FUNCTION ic_private.purge_expired_inbox_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  removed_messages bigint := 0;
  removed_threads bigint := 0;
  removed_webhook_events bigint := 0;
BEGIN
  DELETE FROM public.ic_inbox_messages WHERE retention_expires_at <= now();
  GET DIAGNOSTICS removed_messages = ROW_COUNT;
  DELETE FROM public.ic_inbox_threads WHERE retention_expires_at <= now();
  GET DIAGNOSTICS removed_threads = ROW_COUNT;
  SELECT ic_private.purge_expired_webhook_events() INTO removed_webhook_events;
  RETURN jsonb_build_object(
    'inbox_messages', removed_messages,
    'inbox_threads', removed_threads,
    'webhook_events', removed_webhook_events,
    'executed_at', now()
  );
END;
$$;
REVOKE ALL ON FUNCTION ic_private.purge_expired_inbox_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ic_private.purge_expired_inbox_data() TO service_role;
SELECT cron.schedule('i-connect-communications-retention', '17 2 * * *', 'select ic_private.purge_expired_inbox_data();');
