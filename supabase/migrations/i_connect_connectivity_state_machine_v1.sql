-- I-CONNECT connectivity lifecycle state machine.
-- Carrier credentials and raw SIM identifiers are intentionally kept out of this schema.

create table if not exists public.ic_connectivity_services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  customer_user_id uuid references auth.users(id) on delete set null,
  provider text,
  service_type text not null default 'mobile_connectivity' check (service_type in ('mobile_connectivity','data_connectivity','iot_connectivity')),
  plan_code text,
  lifecycle_state text not null default 'pending_kyc' check (lifecycle_state in ('pending_kyc','ready_for_provisioning','provisioning','active','suspended','termination_pending','terminated','failed','blocked')),
  sim_type text check (sim_type in ('physical','esim','dual','unknown')),
  msisdn_masked text,
  iccid_ref text,
  eid_ref text,
  imsi_ref text,
  external_subscriber_ref text,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ic_connectivity_events (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.ic_connectivity_services(id) on delete cascade,
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  from_state text,
  to_state text not null,
  reason text,
  provider text,
  external_reference text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ic_connectivity_services_org_state_idx on public.ic_connectivity_services(organization_id,lifecycle_state,created_at desc);
create index if not exists ic_connectivity_services_provider_idx on public.ic_connectivity_services(provider,lifecycle_state);
create index if not exists ic_connectivity_events_service_time_idx on public.ic_connectivity_events(service_id,created_at desc);

alter table public.ic_connectivity_services enable row level security;
alter table public.ic_connectivity_events enable row level security;

create policy ic_connectivity_service_read on public.ic_connectivity_services for select to authenticated
using (ic_private.is_member(organization_id));
create policy ic_connectivity_service_manage on public.ic_connectivity_services for all to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','manager']))
with check (ic_private.has_role(organization_id,array['owner','admin','manager']));

create policy ic_connectivity_event_read on public.ic_connectivity_events for select to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','manager']));

create or replace function ic_private.valid_connectivity_transition(from_state text, to_state text)
returns boolean
language sql
immutable
as $$
  select case
    when from_state = to_state then true
    when from_state = 'pending_kyc' and to_state = 'ready_for_provisioning' then true
    when from_state = 'ready_for_provisioning' and to_state in ('provisioning','blocked') then true
    when from_state = 'provisioning' and to_state in ('active','failed','blocked') then true
    when from_state = 'active' and to_state in ('suspended','termination_pending','blocked') then true
    when from_state = 'suspended' and to_state in ('active','termination_pending','blocked') then true
    when from_state = 'termination_pending' and to_state in ('terminated','failed') then true
    when from_state = 'failed' and to_state in ('ready_for_provisioning','provisioning','blocked') then true
    else false
  end;
$$;

create or replace function public.ic_transition_connectivity_service(
  p_service_id uuid,
  p_to_state text,
  p_reason text default null,
  p_provider text default null,
  p_external_reference text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.ic_connectivity_services
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_service public.ic_connectivity_services;
  v_from text;
begin
  select * into v_service from public.ic_connectivity_services where id = p_service_id for update;
  if not found then raise exception 'connectivity_service_not_found'; end if;
  if auth.uid() is not null and not ic_private.has_role(v_service.organization_id,array['owner','admin','manager']) then
    raise exception 'not_authorized';
  end if;
  v_from := v_service.lifecycle_state;
  if not ic_private.valid_connectivity_transition(v_from,p_to_state) then
    raise exception 'invalid_connectivity_transition:%->%',v_from,p_to_state;
  end if;
  update public.ic_connectivity_services
    set lifecycle_state = p_to_state,
        provider = coalesce(p_provider,provider),
        external_subscriber_ref = coalesce(p_external_reference,external_subscriber_ref),
        metadata = coalesce(p_metadata,metadata),
        updated_at = now()
  where id = p_service_id
  returning * into v_service;
  insert into public.ic_connectivity_events(service_id,organization_id,from_state,to_state,reason,provider,external_reference,metadata)
  values (v_service.id,v_service.organization_id,v_from,p_to_state,p_reason,v_service.provider,v_service.external_subscriber_ref,coalesce(p_metadata,'{}'::jsonb));
  return v_service;
end;
$$;

revoke all on function public.ic_transition_connectivity_service(uuid,text,text,text,text,jsonb) from public;
grant execute on function public.ic_transition_connectivity_service(uuid,text,text,text,text,jsonb) to authenticated,service_role;

create or replace function ic_private.select_connectivity_provider(p_service_type text default 'mobile_connectivity')
returns text
language sql
stable
as $$
  select provider from public.ic_provider_adapters
  where service = p_service_type and status in ('configured','ready','active')
  order by priority asc, provider asc
  limit 1;
$$;

revoke all on function ic_private.select_connectivity_provider(text) from public;
grant execute on function ic_private.select_connectivity_provider(text) to service_role;
