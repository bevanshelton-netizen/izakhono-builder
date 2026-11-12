CREATE OR REPLACE FUNCTION public.ic_manage_inbox_thread(
  p_organization_id uuid,
  p_thread_id uuid,
  p_action text,
  p_assignee_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_priority text DEFAULT NULL,
  p_queue_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, ic_private
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role text;
  v_thread public.ic_inbox_threads%ROWTYPE;
  v_assignee_role text;
  v_old jsonb;
BEGIN
  IF v_actor IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT m.role INTO v_role FROM public.ic_memberships m
  WHERE m.organization_id = p_organization_id AND m.user_id = v_actor AND m.status = 'active';
  IF v_role IS NULL THEN RAISE EXCEPTION 'Active organisation membership required'; END IF;

  SELECT * INTO v_thread FROM public.ic_inbox_threads t
  WHERE t.id = p_thread_id AND t.organization_id = p_organization_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inbox conversation not found'; END IF;
  v_old := jsonb_build_object('status',v_thread.status,'priority',v_thread.priority,
    'assigned_to',v_thread.assigned_to,'queue_id',v_thread.queue_id);

  IF p_action = 'claim' THEN
    IF v_thread.assigned_to IS NOT NULL AND v_thread.assigned_to <> v_actor THEN
      RAISE EXCEPTION 'Conversation is already assigned to another agent';
    END IF;
    UPDATE public.ic_inbox_threads SET assigned_to=v_actor, status='open', updated_at=now()
      WHERE id=p_thread_id AND organization_id=p_organization_id;
  ELSIF p_action = 'release' THEN
    IF v_thread.assigned_to <> v_actor AND v_role NOT IN ('owner','admin','manager') THEN
      RAISE EXCEPTION 'Agents may release only their own assigned conversations';
    END IF;
    UPDATE public.ic_inbox_threads SET assigned_to=NULL, status='open', updated_at=now()
      WHERE id=p_thread_id AND organization_id=p_organization_id;
  ELSIF p_action = 'assign' THEN
    IF v_role NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION 'Manager permission required to assign another agent'; END IF;
    IF p_assignee_id IS NOT NULL THEN
      SELECT m.role INTO v_assignee_role FROM public.ic_memberships m
      WHERE m.organization_id=p_organization_id AND m.user_id=p_assignee_id
        AND m.status='active' AND m.role IN ('owner','admin','manager','agent');
      IF v_assignee_role IS NULL THEN RAISE EXCEPTION 'Assignee must be an active organisation agent or manager'; END IF;
    END IF;
    UPDATE public.ic_inbox_threads SET assigned_to=p_assignee_id, updated_at=now()
      WHERE id=p_thread_id AND organization_id=p_organization_id;
  ELSIF p_action = 'status' THEN
    IF v_role NOT IN ('owner','admin','manager') AND v_thread.assigned_to IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'Only the assigned agent or a manager may change conversation status';
    END IF;
    IF p_status NOT IN ('open','pending','waiting_customer','waiting_team','closed','archived') THEN
      RAISE EXCEPTION 'Unsupported conversation status';
    END IF;
    UPDATE public.ic_inbox_threads SET status=p_status, updated_at=now()
      WHERE id=p_thread_id AND organization_id=p_organization_id;
  ELSIF p_action = 'priority' THEN
    IF v_role NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION 'Manager permission required to change priority'; END IF;
    IF p_priority NOT IN ('low','normal','high','urgent') THEN RAISE EXCEPTION 'Unsupported priority'; END IF;
    UPDATE public.ic_inbox_threads SET priority=p_priority, updated_at=now()
      WHERE id=p_thread_id AND organization_id=p_organization_id;
  ELSIF p_action = 'queue' THEN
    IF v_role NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION 'Manager permission required to route conversations'; END IF;
    IF p_queue_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.ic_contact_queues q
      WHERE q.id=p_queue_id AND q.organization_id=p_organization_id AND q.status='active'
    ) THEN RAISE EXCEPTION 'Queue must be active and belong to this organisation'; END IF;
    UPDATE public.ic_inbox_threads SET queue_id=p_queue_id, updated_at=now()
      WHERE id=p_thread_id AND organization_id=p_organization_id;
  ELSE
    RAISE EXCEPTION 'Unsupported inbox management action';
  END IF;

  INSERT INTO public.ic_audit_events(organization_id,actor_user_id,action,resource_type,resource_id,metadata)
  VALUES (p_organization_id,v_actor,'inbox.'||p_action,'inbox_thread',p_thread_id::text,
    jsonb_build_object('before',v_old,'after',jsonb_build_object(
      'status',(SELECT status FROM public.ic_inbox_threads WHERE id=p_thread_id),
      'priority',(SELECT priority FROM public.ic_inbox_threads WHERE id=p_thread_id),
      'assigned_to',(SELECT assigned_to FROM public.ic_inbox_threads WHERE id=p_thread_id),
      'queue_id',(SELECT queue_id FROM public.ic_inbox_threads WHERE id=p_thread_id)
    )));
  RETURN jsonb_build_object('updated',true,'thread_id',p_thread_id,'action',p_action);
END;
$$;
REVOKE ALL ON FUNCTION public.ic_manage_inbox_thread(uuid,uuid,text,uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ic_manage_inbox_thread(uuid,uuid,text,uuid,text,text,uuid) TO authenticated;
