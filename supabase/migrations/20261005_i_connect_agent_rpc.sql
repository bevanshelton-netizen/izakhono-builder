-- I-CONNECT agent RPC surface
-- User-scoped session upsert and call-event recording for the Agent App.

create or replace function public.ic_upsert_agent_session(
  p_organization_id uuid,
  p_state text default 'ready',
  p_device_label text default null
)
returns table (
  session_id uuid,
  agent_id uuid,
  state text,
  last_heartbeat_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_agent public.ic_agents%rowtype;
  v_session public.ic_agent_sessions%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  if p_state not in ('ready','busy','wrap_up','paused','offline') then
    raise exception 'invalid state';
  end if;

  select a.* into v_agent
  from public.ic_agents a
  where a.organization_id = p_organization_id
    and a.user_id = (select auth.uid())
  limit 1;

  if v_agent.id is null then
    raise exception 'agent profile not found';
  end if;

  update public.ic_agents
  set status = p_state,
      last_seen_at = now(),
      updated_at = now()
  where id = v_agent.id;

  insert into public.ic_agent_sessions(
    organization_id,agent_id,user_id,state,device_label,last_heartbeat_at,ended_at
  ) values (
    p_organization_id,v_agent.id,(select auth.uid()),p_state,p_device_label,now(),
    case when p_state = 'offline' then now() else null end
  )
  on conflict (agent_id,user_id) do update
  set state = excluded.state,
      device_label = coalesce(excluded.device_label,public.ic_agent_sessions.device_label),
      last_heartbeat_at = now(),
      ended_at = case when excluded.state = 'offline' then now() else null end
  returning * into v_session;

  return query select v_session.id,v_session.agent_id,v_session.state,v_session.last_heartbeat_at;
end;
$$;

revoke all on function public.ic_upsert_agent_session(uuid,text,text) from public, anon;
grant execute on function public.ic_upsert_agent_session(uuid,text,text) to authenticated;

create or replace function public.ic_record_call_event(
  p_call_id uuid,
  p_event_type text,
  p_payload jsonb default '{}'::jsonb
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_call public.ic_calls%rowtype;
  v_event_id bigint;
  v_next_status text;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required';
  end if;

  select c.* into v_call
  from public.ic_calls c
  where c.id = p_call_id
  limit 1;

  if v_call.id is null then
    raise exception 'call not found';
  end if;

  if not coalesce(ic_private.has_role(
    v_call.organization_id,
    array['owner','admin','manager','agent']
  ), false) then
    raise exception 'not authorised';
  end if;

  if p_event_type not in (
    'agent_ringing','accepted','bridge_requested','bridging','connected','held',
    'resumed','transferred','completed','failed','abandoned','dispositioned'
  ) then
    raise exception 'invalid event type';
  end if;

  v_next_status := case p_event_type
    when 'agent_ringing' then 'ringing_agent'
    when 'accepted' then 'ringing_agent'
    when 'bridge_requested' then 'bridging'
    when 'bridging' then 'bridging'
    when 'connected' then 'connected'
    when 'held' then 'held'
    when 'resumed' then 'connected'
    when 'completed' then 'completed'
    when 'failed' then 'failed'
    when 'abandoned' then 'abandoned'
    else v_call.status
  end;

  update public.ic_calls
  set status = v_next_status,
      answered_at = case when p_event_type = 'connected' and answered_at is null then now() else answered_at end,
      ended_at = case when p_event_type in ('completed','failed','abandoned') then now() else ended_at end,
      disposition = case when p_event_type = 'dispositioned' then p_payload->>'disposition' else disposition end
  where id = p_call_id;

  insert into public.ic_call_events(
    organization_id,call_id,actor_user_id,event_type,payload
  ) values (
    v_call.organization_id,p_call_id,(select auth.uid()),p_event_type,coalesce(p_payload,'{}'::jsonb)
  )
  returning id into v_event_id;

  return v_event_id;
end;
$$;

revoke all on function public.ic_record_call_event(uuid,text,jsonb) from public, anon;
grant execute on function public.ic_record_call_event(uuid,text,jsonb) to authenticated;
