-- I-CONNECT production control-plane expansion
-- Hardens RBAC helpers and adds contact-centre, provisioning, billing and CDR state.

create schema if not exists ic_private;
revoke all on schema ic_private from public;
grant usage on schema ic_private to authenticated;

drop policy if exists ic_org_select on public.ic_organizations;
drop policy if exists ic_org_manage on public.ic_organizations;
drop policy if exists ic_membership_select on public.ic_memberships;
drop policy if exists ic_membership_manage on public.ic_memberships;
drop policy if exists ic_entitlement_select on public.ic_service_entitlements;
drop policy if exists ic_entitlement_manage on public.ic_service_entitlements;
drop policy if exists ic_audit_select on public.ic_audit_events;
drop policy if exists ic_audit_insert on public.ic_audit_events;

drop function if exists public.ic_is_member(uuid);
drop function if exists public.ic_has_role(uuid,text[]);

create or replace function ic_private.is_member(org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.ic_memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create or replace function ic_private.has_role(org_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null and exists (
    select 1 from public.ic_memberships m
    where m.organization_id = org_id
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function ic_private.is_member(uuid) from public;
revoke all on function ic_private.has_role(uuid,text[]) from public;
grant execute on function ic_private.is_member(uuid) to authenticated;
grant execute on function ic_private.has_role(uuid,text[]) to authenticated;

create policy ic_org_select on public.ic_organizations for select
to authenticated using (ic_private.is_member(id));
create policy ic_org_manage on public.ic_organizations for update
to authenticated using (ic_private.has_role(id,array['owner','admin']))
with check (ic_private.has_role(id,array['owner','admin']));

create policy ic_membership_select on public.ic_memberships for select
to authenticated using (ic_private.is_member(organization_id));
create policy ic_membership_manage on public.ic_memberships for all
to authenticated using (ic_private.has_role(organization_id,array['owner','admin']))
with check (ic_private.has_role(organization_id,array['owner','admin']));

create policy ic_entitlement_select on public.ic_service_entitlements for select
to authenticated using (ic_private.is_member(organization_id));
create policy ic_entitlement_manage on public.ic_service_entitlements for all
to authenticated using (ic_private.has_role(organization_id,array['owner','admin']))
with check (ic_private.has_role(organization_id,array['owner','admin']));

create policy ic_audit_select on public.ic_audit_events for select
to authenticated using (ic_private.has_role(organization_id,array['owner','admin','manager']));
create policy ic_audit_insert on public.ic_audit_events for insert
to authenticated with check (actor_user_id = auth.uid() and ic_private.is_member(organization_id));

create table if not exists public.ic_contact_queues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  name text not null,
  service_number text,
  status text not null default 'active' check (status in ('active','paused','closed')),
  strategy text not null default 'longest_idle' check (strategy in ('longest_idle','round_robin','skills')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ic_agents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  registered_mobile text,
  status text not null default 'offline' check (status in ('offline','ready','busy','wrap_up','paused')),
  bridge_mode text not null default 'mobile' check (bridge_mode in ('mobile','softphone')),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,user_id)
);

create table if not exists public.ic_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  queue_id uuid references public.ic_contact_queues(id) on delete set null,
  agent_id uuid references public.ic_agents(id) on delete set null,
  direction text not null check (direction in ('inbound','outbound')),
  customer_number_masked text,
  provider_call_id text,
  status text not null default 'queued' check (status in ('queued','assigned','ringing_agent','bridging','connected','held','completed','failed','abandoned')),
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  billable_seconds integer not null default 0 check (billable_seconds >= 0),
  disposition text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.ic_provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  service text not null,
  action text not null,
  idempotency_key text not null unique,
  state text not null default 'pending' check (state in ('pending','approved','running','waiting_provider','completed','failed','cancelled')),
  provider text,
  external_reference text,
  attempts integer not null default 0 check (attempts >= 0),
  requested_by uuid references auth.users(id) on delete set null,
  payload jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ic_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  invoice_number text not null unique,
  currency text not null default 'ZAR',
  subtotal_cents bigint not null default 0 check (subtotal_cents >= 0),
  tax_cents bigint not null default 0 check (tax_cents >= 0),
  total_cents bigint not null default 0 check (total_cents >= 0),
  status text not null default 'draft' check (status in ('draft','issued','paid','overdue','void')),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.ic_usage_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  service text not null,
  source_type text not null,
  source_id text,
  quantity numeric(18,6) not null default 0 check (quantity >= 0),
  unit text not null,
  unit_price_cents numeric(18,6) not null default 0 check (unit_price_cents >= 0),
  amount_cents bigint not null default 0 check (amount_cents >= 0),
  occurred_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists ic_calls_org_time_idx on public.ic_calls(organization_id,started_at desc);
create index if not exists ic_calls_queue_status_idx on public.ic_calls(queue_id,status);
create index if not exists ic_agents_org_status_idx on public.ic_agents(organization_id,status);
create index if not exists ic_provisioning_org_state_idx on public.ic_provisioning_jobs(organization_id,state,created_at);
create index if not exists ic_invoices_org_status_idx on public.ic_invoices(organization_id,status,created_at desc);
create index if not exists ic_usage_org_time_idx on public.ic_usage_records(organization_id,occurred_at desc);

alter table public.ic_contact_queues enable row level security;
alter table public.ic_agents enable row level security;
alter table public.ic_calls enable row level security;
alter table public.ic_provisioning_jobs enable row level security;
alter table public.ic_invoices enable row level security;
alter table public.ic_usage_records enable row level security;

create policy ic_queue_read on public.ic_contact_queues for select to authenticated
using (ic_private.is_member(organization_id));
create policy ic_queue_manage on public.ic_contact_queues for all to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','manager']))
with check (ic_private.has_role(organization_id,array['owner','admin','manager']));

create policy ic_agent_read on public.ic_agents for select to authenticated
using (ic_private.is_member(organization_id));
create policy ic_agent_self_update on public.ic_agents for update to authenticated
using (user_id = auth.uid() and ic_private.is_member(organization_id))
with check (user_id = auth.uid() and ic_private.is_member(organization_id));
create policy ic_agent_manage on public.ic_agents for all to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','manager']))
with check (ic_private.has_role(organization_id,array['owner','admin','manager']));

create policy ic_call_read on public.ic_calls for select to authenticated
using (ic_private.is_member(organization_id));
create policy ic_call_manage on public.ic_calls for all to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','manager','agent']))
with check (ic_private.has_role(organization_id,array['owner','admin','manager','agent']));

create policy ic_provisioning_read on public.ic_provisioning_jobs for select to authenticated
using (ic_private.is_member(organization_id));
create policy ic_provisioning_manage on public.ic_provisioning_jobs for all to authenticated
using (ic_private.has_role(organization_id,array['owner','admin']))
with check (ic_private.has_role(organization_id,array['owner','admin']));

create policy ic_invoice_read on public.ic_invoices for select to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','manager','finance']));
create policy ic_invoice_manage on public.ic_invoices for all to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','finance']))
with check (ic_private.has_role(organization_id,array['owner','admin','finance']));

create policy ic_usage_read on public.ic_usage_records for select to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','manager','finance']));
create policy ic_usage_manage on public.ic_usage_records for all to authenticated
using (ic_private.has_role(organization_id,array['owner','admin','finance']))
with check (ic_private.has_role(organization_id,array['owner','admin','finance']));
