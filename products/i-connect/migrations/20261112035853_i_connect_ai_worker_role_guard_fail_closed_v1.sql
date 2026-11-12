-- Fail closed when worker RPCs are invoked without a service-role JWT claim.
create or replace function public.ic_claim_workflow_test_run(p_worker_id text)
returns table(run_id uuid, organization_id uuid, workflow_id uuid, workflow_version integer, run_input jsonb, workflow_graph jsonb)
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Worker credentials required' using errcode = '42501'; end if;
  update public.ic_workflow_runs r set status='failed',finished_at=now(),
    error=jsonb_build_object('code','WORKER_RETRY_LIMIT','message','The workflow test worker did not complete after three claims.')
   where r.status='running' and r.trigger_type='manual_test' and r.started_at < now()-interval '10 minutes' and r.attempts>=3;
  return query
  with candidate as (
    select r.id from public.ic_workflow_runs r
     where r.trigger_type='manual_test'
       and (r.status='queued' or (r.status='running' and r.started_at < now()-interval '10 minutes' and r.attempts<3))
       and (r.scheduled_at is null or r.scheduled_at<=now())
     order by r.created_at for update skip locked limit 1
  ), claimed as (
    update public.ic_workflow_runs r set status='running',attempts=r.attempts+1,started_at=now(),finished_at=null
      from candidate c where r.id=c.id
      returning r.id,r.organization_id,r.workflow_id,r.workflow_version,r.input
  )
  select c.id,c.organization_id,c.workflow_id,c.workflow_version,c.input,v.graph
    from claimed c join public.ic_workflow_versions v on v.organization_id=c.organization_id and v.workflow_id=c.workflow_id and v.version=c.workflow_version;
end;
$$;

create or replace function public.ic_finish_workflow_test_run(p_run_id uuid,p_status text,p_output jsonb default '{}'::jsonb,p_error jsonb default '{}'::jsonb)
returns boolean language plpgsql security definer set search_path=public,pg_temp
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Worker credentials required' using errcode='42501'; end if;
  if p_status not in ('completed','failed','needs_human') then raise exception 'Invalid terminal workflow run status' using errcode='22023'; end if;
  update public.ic_workflow_runs set status=p_status,output=coalesce(p_output,'{}'::jsonb),error=coalesce(p_error,'{}'::jsonb),finished_at=now()
   where id=p_run_id and status='running';
  return found;
end;
$$;

revoke all on function public.ic_claim_workflow_test_run(text) from public,anon,authenticated;
revoke all on function public.ic_finish_workflow_test_run(uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.ic_claim_workflow_test_run(text) to service_role;
grant execute on function public.ic_finish_workflow_test_run(uuid,text,jsonb,jsonb) to service_role;
