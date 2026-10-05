-- I-CONNECT agent runtime hardening
-- Private agent endpoints, atomic queue assignment, session heartbeat and immutable call events.

create table if not exists ic_private.agent_endpoints (
  agent_id uuid primary key references public.ic_agents(id) on delete cascade,
  mobile_e164 text,
  sip_uri text,
  verified_at timestamptz,
  updated_at timestamptz not null default now()
);

revoke all on table ic_private.agent_endpoints from public, anon, authenticated;

insert into ic_private.agent_endpoints (agent_id, mobile_e164)
select id, registered_mobile
from public.ic_agents
where registered_mobile is not null
on conflict (agent_id) do update
set mobile_e164 = excluded.mobile_e164,
    updated_at = now();

alter table public.ic_agents drop column if exists registered_mobile;

create table if not exists public.ic_agent_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  agent_id uuid not null references public.ic_agents(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  state text not null default 'ready' check (state in ('ready','busy','wrap_up','paused','offline')),
  device_label text,
  last_heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  unique(agent_id,user_id)
);

create table if not exists public.ic_call_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  call_id uuid not null references public.ic_calls(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in (
    'queued','assigned','agent_ringing','accepted','bridge_requested','bridging',
    'connected','held','resumed','transferred','completed','failed','abandoned','dispositioned'
  )),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ic_agent_sessions_org_state_idx
  on public.ic_agent_sessions(organization_id,state,last_heartbeat_at desc);
create index if not exists ic_call_events_call_time_idx
  on public.ic_call_events(call_id,created_at);

alter table public.ic_agent_sessions enable row level security;
alter table public.ic_call_events enable row level security;

create policy ic_agent_session_self_read on public.ic_agent_sessions for select to authenticated
using (user_id = (select auth.uid()) and (select ic_private.is_member(organization_id)));

create policy ic_agent_session_self_manage on public.ic_agent_sessions for all to authenticated
using (user_id = (select auth.uid()) and (select ic_private.is_member(organization_id)))
with check (user_id = (select auth.uid()) and (select ic_private.is_member(organization_id)));

create policy ic_agent_session_manager_read on public.ic_agent_sessions for select to authenticated
using ((select ic_private.has_role(organization_id,array['owner','admin','manager'])));

create policy ic_call_event_read on public.ic_call_events for select to authenticated
using ((select ic_private.is_member(organization_id)));

create policy ic_call_event_insert on public.ic_call_events for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and (select ic_private.has_role(organization_id,array['owner','admin','manager','agent']))
);

create or replace function ic_private.assign_next_call(p_organization_id uuid)
returns table (
  call_id uuid,
  queue_id uuid,
  customer_number_masked text,
  direction text,
  started_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agent_id uuid;
  v_call public.ic_calls%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if not coalesce(ic_private.has_role(
    p_organization_id,
    array['owner','admin','manager','agent']
  ), false) then
    raise exception 'not authorised';
  end if;

  select a.id into v_agent_id
  from public.ic_agents a
  where a.organization_id = p_organization_id
    and a.user_id = (select auth.uid())
    and a.status = 'ready'
  limit 1;

  if v_agent_id is null then
    raise exception 'agent not ready';
  end if;

  select c.* into v_call
  from public.ic_calls c
  where c.organization_id = p_organization_id
    and c.status = 'queued'
  order by c.started_at asc
  for update skip locked
  limit 1;

  if v_call.id is null then
    return;
  end if;

  update public.ic_calls
  set agent_id = v_agent_id,
      status = 'assigned'
  where id = v_call.id;

  update public.ic_agents
  set status = 'busy',
      last_seen_at = now(),
      updated_at = now()
  where id = v_agent_id;

  insert into public.ic_call_events(
    organization_id,call_id,actor_user_id,event_type,payload
  ) values (
    p_organization_id,v_call.id,(select auth.uid()),'assigned',
    jsonb_build_object('agent_id',v_agent_id)
  );

  return query
  select v_call.id, v_call.queue_id, v_call.customer_number_masked,
         v_call.direction, v_call.started_at;
end;
$$;

revoke all on function ic_private.assign_next_call(uuid) from public, anon, authenticated;
grant execute on function ic_private.assign_next_call(uuid) to authenticated;

create or replace function public.ic_assign_next_call(p_organization_id uuid)
returns table (
  call_id uuid,
  queue_id uuid,
  customer_number_masked text,
  direction text,
  started_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from ic_private.assign_next_call(p_organization_id);
$$;

revoke all on function public.ic_assign_next_call(uuid) from public, anon;
grant execute on function public.ic_assign_next_call(uuid) to authenticated;
