CREATE OR REPLACE FUNCTION public.ic_add_inbox_internal_note(
  p_organization_id uuid,
  p_thread_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, ic_private
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_thread public.ic_inbox_threads%ROWTYPE;
  v_note_id uuid;
  v_body text := btrim(coalesce(p_body,''));
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT m.role INTO v_role FROM public.ic_memberships m
  WHERE m.organization_id=p_organization_id AND m.user_id=v_actor AND m.status='active';
  IF v_role IS NULL THEN RAISE EXCEPTION 'Active organisation membership required'; END IF;
  SELECT * INTO v_thread FROM public.ic_inbox_threads t
  WHERE t.id=p_thread_id AND t.organization_id=p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inbox conversation not found'; END IF;
  IF v_role NOT IN ('owner','admin','manager') AND v_thread.assigned_to IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'Only the assigned agent or a manager may add internal notes';
  END IF;
  IF length(v_body)=0 OR length(v_body)>5000 THEN RAISE EXCEPTION 'Internal note must contain 1 to 5000 characters'; END IF;
  INSERT INTO public.ic_inbox_messages(organization_id,thread_id,direction,message_type,body,delivery_status,provider_timestamp)
  VALUES(p_organization_id,p_thread_id,'internal_note','system',v_body,'received',now())
  RETURNING id INTO v_note_id;
  INSERT INTO public.ic_audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  VALUES(p_organization_id,v_actor,'inbox.internal_note','inbox_thread',p_thread_id::text,
    jsonb_build_object('message_id',v_note_id,'body_length',length(v_body)));
  RETURN v_note_id;
END;
$$;
REVOKE ALL ON FUNCTION public.ic_add_inbox_internal_note(uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ic_add_inbox_internal_note(uuid,uuid,text) TO authenticated;
