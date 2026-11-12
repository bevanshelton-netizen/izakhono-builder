-- I-CONNECT workflow test-run queue and atomic worker lifecycle.
create unique index if not exists ic_workflow_runs_org_idempotency_uidx
  on public.ic_workflow_runs (organization_id, idempotency_key)
  where idempotency_key is not null;

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
  v_run_id uuid;
begin
  if v_user is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  if not ic_private.has_role(p_organization_id, array['owner','admin','manager']) then
    raise exception 'Insufficient organisation permissions' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(p_idempotency_key) > 160 then
    raise exception 'A valid idempotency key is required' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_input, '{}'::jsonb)) <> 'object' then
    raise exception 'Run input must be a JSON object' using errcode = '22023';
  end if;

  select w.current_version into v_version
    from public.ic_workflows w
   where w.id = p_workflow_id
     and w.organization_id = p_organization_id
     and w.status = 'draft';
  if v_version is null then
    raise exception 'Only a saved draft workflow in this organisation can be test-run' using errcode = 'P0002';
  end if;

  select r.id, r.workflow_version into v_run_id, v_version
    from public.ic_workflow_runs r
   where r.organization_id = p_organization_id
     and r.idempotency_key = p_idempotency_key;
  if v_run_id is not null then
    return query select v_run_id, v_version, 'existing'::text;
    return;
  end if;

  insert into public.ic_workflow_runs
    (organization_id, workflow_id, workflow_version, trigger_type,
     trigger_reference, status, idempotency_key, input)
  values
    (p_organization_id, p_workflow_id, v_version, 'manual_test',
     'automation_studio', 'queued', p_idempotency_key,
     coalesce(p_input, '{}'::jsonb) || jsonb_build_object('mode','simulation','requested_by',v_user))
  returning id into v_run_id;

  return query select v_run_id, v_version, 'queued'::text;
exception
  when unique_violation then
    select r.id, r.workflow_version into v_run_id, v_version
      from public.ic_workflow_runs r
     where r.organization_id = p_organization_id
       and r.idempotency_key = p_idempotency_key;
    return query select v_run_id, v_version, 'existing'::text;
end;
$$;

create or replace function public.ic_claim_workflow_test_run(p_worker_id text)
returns table(
  run_id uuid,
  organization_id uuid,
  workflow_id uuid,
  workflow_version integer,
  run_input jsonb,
  workflow_graph jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Worker credentials required' using errcode = '42501';
  end if;
  return query
  with candidate as (
    select r.id
      from public.ic_workflow_runs r
     where r.status = 'queued'
       and r.trigger_type = 'manual_test'
       and (r.scheduled_at is null or r.scheduled_at <= now())
     order by r.created_at
     for update skip locked
     limit 1
  ), claimed as (
    update public.ic_workflow_runs r
       set status = 'running',
           attempts = r.attempts + 1,
           started_at = coalesce(r.started_at, now())
      from candidate c
     where r.id = c.id
     returning r.id, r.organization_id, r.workflow_id, r.workflow_version, r.input
  )
  select c.id, c.organization_id, c.workflow_id, c.workflow_version, c.input, v.graph
    from claimed c
    join public.ic_workflow_versions v
      on v.organization_id = c.organization_id
     and v.workflow_id = c.workflow_id
     and v.version = c.workflow_version;
end;
$$;

create or replace function public.ic_finish_workflow_test_run(
  p_run_id uuid,
  p_status text,
  p_output jsonb default '{}'::jsonb,
  p_error jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'Worker credentials required' using errcode = '42501';
  end if;
  if p_status not in ('completed','failed','needs_human') then
    raise exception 'Invalid terminal workflow run status' using errcode = '22023';
  end if;
  update public.ic_workflow_runs
     set status = p_status,
         output = coalesce(p_output, '{}'::jsonb),
         error = coalesce(p_error, '{}'::jsonb),
         finished_at = now()
   where id = p_run_id
     and status = 'running';
  return found;
end;
$$;

revoke all on function public.ic_enqueue_workflow_test_run(uuid,uuid,text,jsonb) from public, anon;
revoke all on function public.ic_claim_workflow_test_run(text) from public, anon, authenticated;
revoke all on function public.ic_finish_workflow_test_run(uuid,text,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.ic_enqueue_workflow_test_run(uuid,uuid,text,jsonb) to authenticated;
grant execute on function public.ic_claim_workflow_test_run(text) to service_role;
grant execute on function public.ic_finish_workflow_test_run(uuid,text,jsonb,jsonb) to service_role;
