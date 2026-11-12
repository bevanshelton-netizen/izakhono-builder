create or replace function public.ic_enqueue_workflow_test_run(
  p_organization_id uuid,
  p_workflow_id uuid,
  p_idempotency_key text,
  p_input jsonb default '{}'::jsonb
)
returns table(run_id uuid, workflow_version integer, run_status text)
language plpgsql
security definer
set search_path = public, ic_private, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_version integer;
  v_existing_version integer;
  v_run_id uuid;
begin
  if v_user is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if not ic_private.has_role(p_organization_id, array['owner','admin','manager']) then
    raise exception 'Insufficient organisation permissions' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(p_idempotency_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_input, '{}'::jsonb)) <> 'object' then
    raise exception 'Run input must be a JSON object' using errcode = '22023';
  end if;
  select w.current_version into v_version from public.ic_workflows w
   where w.id = p_workflow_id and w.organization_id = p_organization_id and w.status = 'draft';
  if v_version is null then raise exception 'Only a saved draft workflow in this organisation can be test-run' using errcode = 'P0002'; end if;
  select r.id, r.workflow_version into v_run_id, v_existing_version
    from public.ic_workflow_runs r where r.organization_id = p_organization_id and r.idempotency_key = p_idempotency_key;
  if v_run_id is not null then
    return query select v_run_id, v_existing_version, 'existing'::text;
    return;
  end if;
  insert into public.ic_workflow_runs
    (organization_id, workflow_id, workflow_version, trigger_type, trigger_reference, status, idempotency_key, input)
  values (p_organization_id, p_workflow_id, v_version, 'manual_test', 'automation_studio', 'queued', p_idempotency_key,
    coalesce(p_input, '{}'::jsonb) || jsonb_build_object('mode','simulation','requested_by',v_user))
  returning id into v_run_id;
  return query select v_run_id, v_version, 'queued'::text;
exception when unique_violation then
  select r.id, r.workflow_version into v_run_id, v_existing_version
    from public.ic_workflow_runs r where r.organization_id = p_organization_id and r.idempotency_key = p_idempotency_key;
  return query select v_run_id, v_existing_version, 'existing'::text;
end;
$$;