-- I-CONNECT authenticated workflow save RPC.
-- SECURITY INVOKER preserves the caller's RLS context; organisation role is rechecked.
create or replace function public.ic_save_workflow(
  p_organization_id uuid,
  p_workflow_id uuid,
  p_name text,
  p_description text,
  p_graph jsonb
)
returns table(workflow_id uuid, workflow_version integer)
language plpgsql
security invoker
set search_path = public, ic_private, pg_temp
as $$
declare
  v_workflow_id uuid;
  v_version integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not ic_private.has_role(p_organization_id, array['owner','admin','manager']) then
    raise exception 'Insufficient organisation permissions' using errcode = '42501';
  end if;
  if nullif(trim(p_name), '') is null then
    raise exception 'Workflow name is required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_graph) <> 'object' then
    raise exception 'Workflow graph must be a JSON object' using errcode = '22023';
  end if;

  if p_workflow_id is null then
    insert into public.ic_workflows (organization_id, name, description, created_by)
    values (p_organization_id, trim(p_name), p_description, auth.uid())
    returning id, current_version into v_workflow_id, v_version;
  else
    update public.ic_workflows w
       set name = trim(p_name),
           description = p_description,
           current_version = w.current_version + 1,
           updated_at = now()
     where w.id = p_workflow_id
       and w.organization_id = p_organization_id
    returning w.id, w.current_version into v_workflow_id, v_version;
    if v_workflow_id is null then
      raise exception 'Workflow not found in this organisation' using errcode = 'P0002';
    end if;
  end if;

  insert into public.ic_workflow_versions
    (organization_id, workflow_id, version, graph, validation_state, created_by)
  values
    (p_organization_id, v_workflow_id, v_version, p_graph, 'draft', auth.uid());

  return query select v_workflow_id, v_version;
end;
$$;

revoke all on function public.ic_save_workflow(uuid,uuid,text,text,jsonb) from public, anon;
grant execute on function public.ic_save_workflow(uuid,uuid,text,text,jsonb) to authenticated;
