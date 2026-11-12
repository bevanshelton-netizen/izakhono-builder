DROP INDEX public.ic_contacts_org_phone_idx;
CREATE UNIQUE INDEX ic_contacts_org_phone_unique_idx
  ON public.ic_contacts(organization_id, phone) WHERE phone IS NOT NULL;
ALTER TABLE public.ic_webhook_events
  ADD COLUMN processing_started_at timestamptz;

CREATE OR REPLACE FUNCTION ic_private.claim_whatsapp_inbox_event()
RETURNS TABLE(event_id uuid, attempts integer)
LANGUAGE sql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  WITH candidate AS (
    SELECT e.id FROM public.ic_webhook_events e
    WHERE e.provider = 'whatsapp' AND e.signature_verified = true AND e.attempts < 3
      AND (e.processing_state IN ('received', 'retry')
        OR (e.processing_state = 'processing' AND coalesce(e.processing_started_at, e.received_at) < now() - interval '10 minutes'))
    ORDER BY e.received_at FOR UPDATE SKIP LOCKED LIMIT 1
  )
  UPDATE public.ic_webhook_events e
  SET processing_state = 'processing', attempts = e.attempts + 1, processing_started_at = now(), last_error = NULL
  FROM candidate c WHERE e.id = c.id
  RETURNING e.id, e.attempts;
$$;

CREATE OR REPLACE FUNCTION ic_private.process_whatsapp_inbox_event(p_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  e public.ic_webhook_events%ROWTYPE;
  v_message jsonb;
  v_status jsonb;
  v_sender text;
  v_display_name text;
  v_phone text;
  v_message_id text;
  v_message_type text;
  v_body text;
  v_status_value text;
  v_message_time timestamptz;
  v_contact_id uuid;
  v_thread_id uuid;
  v_inbox_message_id uuid;
BEGIN
  SELECT * INTO e FROM public.ic_webhook_events WHERE id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Webhook event not found'; END IF;
  IF e.provider <> 'whatsapp' OR e.signature_verified IS NOT TRUE OR e.processing_state <> 'processing' THEN
    RAISE EXCEPTION 'Webhook event is not eligible for processing';
  END IF;

  IF e.event_type = 'message.inbound' THEN
    v_message := e.payload->'message';
    v_sender := nullif(v_message->>'from', '');
    v_message_id := nullif(v_message->>'id', '');
    IF v_sender IS NULL OR v_message_id IS NULL THEN RAISE EXCEPTION 'Inbound WhatsApp message is missing its sender or provider message ID'; END IF;
    PERFORM 1 FROM public.ic_channel_connections c
    WHERE c.id = e.connection_id AND c.organization_id = e.organization_id
      AND c.provider = 'whatsapp' AND c.status = 'active';
    IF NOT FOUND THEN RAISE EXCEPTION 'WhatsApp channel connection is no longer active'; END IF;

    v_display_name := coalesce(nullif(e.payload->'contacts'->0->'profile'->>'name', ''), v_sender);
    v_phone := v_sender;
    v_message_type := CASE v_message->>'type'
      WHEN 'image' THEN 'image' WHEN 'audio' THEN 'audio' WHEN 'video' THEN 'video'
      WHEN 'document' THEN 'document' WHEN 'location' THEN 'location'
      WHEN 'interactive' THEN 'interactive' WHEN 'button' THEN 'interactive' ELSE 'text' END;
    v_body := coalesce(v_message->'text'->>'body', v_message->'image'->>'caption',
      v_message->'video'->>'caption', v_message->'document'->>'caption');
    v_message_time := CASE WHEN coalesce(v_message->>'timestamp', '') ~ '^[0-9]{1,12}$'
      THEN to_timestamp((v_message->>'timestamp')::double precision) ELSE now() END;

    INSERT INTO public.ic_contacts (organization_id, display_name, phone, created_at, updated_at)
    VALUES (e.organization_id, v_display_name, v_phone, now(), now())
    ON CONFLICT (organization_id, phone) WHERE phone IS NOT NULL
    DO UPDATE SET display_name = CASE
      WHEN EXCLUDED.display_name = EXCLUDED.phone THEN public.ic_contacts.display_name
      ELSE EXCLUDED.display_name END, updated_at = now()
    RETURNING id INTO v_contact_id;

    INSERT INTO public.ic_contact_channel_identities
      (organization_id, contact_id, connection_id, provider, external_contact_id, address)
    VALUES (e.organization_id, v_contact_id, e.connection_id, 'whatsapp', v_sender, v_sender)
    ON CONFLICT (connection_id, external_contact_id)
    DO UPDATE SET contact_id = EXCLUDED.contact_id, address = EXCLUDED.address;

    INSERT INTO public.ic_inbox_threads
      (organization_id, contact_id, connection_id, channel, external_thread_id, status, last_message_at)
    VALUES (e.organization_id, v_contact_id, e.connection_id, 'whatsapp', v_sender, 'open', v_message_time)
    ON CONFLICT (connection_id, external_thread_id)
    DO UPDATE SET contact_id = EXCLUDED.contact_id,
      status = CASE WHEN public.ic_inbox_threads.status IN ('closed', 'archived') THEN 'open' ELSE public.ic_inbox_threads.status END,
      last_message_at = greatest(coalesce(public.ic_inbox_threads.last_message_at, EXCLUDED.last_message_at), EXCLUDED.last_message_at),
      updated_at = now()
    RETURNING id INTO v_thread_id;

    INSERT INTO public.ic_inbox_messages
      (organization_id, thread_id, provider_message_id, direction, message_type, body, delivery_status, provider_timestamp)
    VALUES (e.organization_id, v_thread_id, v_message_id, 'inbound', v_message_type, v_body, 'received', v_message_time)
    ON CONFLICT (thread_id, provider_message_id) DO NOTHING
    RETURNING id INTO v_inbox_message_id;
    IF v_inbox_message_id IS NULL THEN
      SELECT id INTO v_inbox_message_id FROM public.ic_inbox_messages
      WHERE thread_id = v_thread_id AND provider_message_id = v_message_id;
    END IF;

    UPDATE public.ic_webhook_events SET processing_state = 'processed', processed_at = now(),
      processing_started_at = NULL, payload = '{}'::jsonb, last_error = NULL WHERE id = e.id;
    RETURN jsonb_build_object('processed', true, 'event_type', e.event_type,
      'contact_id', v_contact_id, 'thread_id', v_thread_id, 'message_id', v_inbox_message_id);

  ELSIF e.event_type LIKE 'message.status.%' THEN
    v_status := e.payload->'status';
    v_message_id := nullif(v_status->>'id', '');
    v_status_value := v_status->>'status';
    IF v_message_id IS NOT NULL AND v_status_value IN ('sent', 'delivered', 'read', 'failed') THEN
      UPDATE public.ic_inbox_messages m SET delivery_status = v_status_value
      FROM public.ic_inbox_threads t
      WHERE t.id = m.thread_id AND t.organization_id = m.organization_id
        AND t.connection_id = e.connection_id AND m.provider_message_id = v_message_id;
    END IF;
    UPDATE public.ic_webhook_events SET processing_state = 'processed', processed_at = now(),
      processing_started_at = NULL, payload = '{}'::jsonb, last_error = NULL WHERE id = e.id;
    RETURN jsonb_build_object('processed', true, 'event_type', e.event_type, 'provider_message_id', v_message_id);
  END IF;

  UPDATE public.ic_webhook_events SET processing_state = 'processed', processed_at = now(),
    processing_started_at = NULL, payload = '{}'::jsonb, last_error = NULL WHERE id = e.id;
  RETURN jsonb_build_object('processed', true, 'event_type', e.event_type, 'ignored', true);
END;
$$;

REVOKE ALL ON FUNCTION ic_private.claim_whatsapp_inbox_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION ic_private.process_whatsapp_inbox_event(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION ic_private.claim_whatsapp_inbox_event() TO service_role;
GRANT EXECUTE ON FUNCTION ic_private.process_whatsapp_inbox_event(uuid) TO service_role;
COMMENT ON FUNCTION ic_private.process_whatsapp_inbox_event(uuid) IS 'Processes only signature-verified WhatsApp webhook events into minimal tenant-scoped inbox records; clears raw event payload after success and never sends messages.';
