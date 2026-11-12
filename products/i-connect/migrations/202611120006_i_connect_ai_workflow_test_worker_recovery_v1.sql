-- Reclaim abandoned manual test runs and dead-letter runs after three worker claims.
create or replace function public.ic_claim_workflow_test_run(p_worker_id text)
returns table(run_id uuid, organization_id uuid, workflow_id uuid, workflow_version integer, run_input jsonb, workflow_graph jsonb)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.role() <> 'service_role' then raise exception 'Worker credentials required' using errcode = '42501'; end if;
  update public.ic_workflow_runs r
     set status = 'failed', finished_at = now(),
         error = jsonb_build_object('code','WORKER_RETRY_LIMIT','message','The workflow test worker did not complete after three claims.')
   where r.status = 'running' and r.trigger_type = 'manual_test'
     and r.started_at < now() - interval '10 minutes' and r.attempts >= 3;
  return query
  with candidate as (
    select r.id from public.ic_workflow_runs r
     where r.trigger_type = 'manual_test'
       and (r.status = 'queued' or (r.status = 'running' and r.started_at < now() - interval '10 minutes' and r.attempts < 3))
       and (r.scheduled_at is null or r.scheduled_at <= now())
     order by r.created_at for update skip locked limit 1
  ), claimed as (
    update public.ic_workflow_runs r set status = 'running', attempts = r.attempts + 1,
      started_at = now(), finished_at = null
      from candidate c where r.id = c.id
      returning r.id, r.organization_id, r.workflow_id, r.workflow_version, r.input
  )
  select c.id, c.organization_id, c.workflow_id, c.workflow_version, c.input, v.graph
    from claimed c join public.ic_workflow_versions v
      on v.organization_id = c.organization_id and v.workflow_id = c.workflow_id and v.version = c.workflow_version;
end;
$$;
