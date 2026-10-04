create table if not exists public.ic_organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  legal_name text,
  status text not null default 'active' check (status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ic_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  status text not null default 'active' check (status in ('active','suspended','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ic_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','admin','manager','agent','dispatcher','finance','viewer')),
  status text not null default 'active' check (status in ('active','invited','suspended','removed')),
  created_at timestamptz not null default now(),
  unique(organization_id,user_id)
);

create table if not exists public.ic_service_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  service text not null check (service in ('voice','contact_centre','mobile','connectivity','wifi','fleet','secure_fleet','provisioner')),
  status text not null default 'active' check (status in ('active','trial','suspended','cancelled')),
  plan_code text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,service)
);

create table if not exists public.ic_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.ic_organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text,
  resource_id text,
  ip inet,
  user_agent text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ic_memberships_user_idx on public.ic_memberships(user_id);
create index if not exists ic_memberships_org_idx on public.ic_memberships(organization_id);
create index if not exists ic_entitlements_org_idx on public.ic_service_entitlements(organization_id);
create index if not exists ic_audit_org_time_idx on public.ic_audit_events(organization_id,created_at desc);

alter table public.ic_organizations enable row level security;
alter table public.ic_profiles enable row level security;
alter table public.ic_memberships enable row level security;
alter table public.ic_service_entitlements enable row level security;
alter table public.ic_audit_events enable row level security;

create or replace function public.ic_is_member(org_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.ic_memberships m where m.organization_id = org_id and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.ic_has_role(org_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.ic_memberships m where m.organization_id = org_id and m.user_id = auth.uid() and m.status = 'active' and m.role = any(allowed_roles));
$$;

create policy ic_org_select on public.ic_organizations for select using (public.ic_is_member(id));
create policy ic_org_manage on public.ic_organizations for update using (public.ic_has_role(id,array['owner','admin'])) with check (public.ic_has_role(id,array['owner','admin']));

create policy ic_profile_self on public.ic_profiles for all using (id = auth.uid()) with check (id = auth.uid());

create policy ic_membership_select on public.ic_memberships for select using (public.ic_is_member(organization_id));
create policy ic_membership_manage on public.ic_memberships for all using (public.ic_has_role(organization_id,array['owner','admin'])) with check (public.ic_has_role(organization_id,array['owner','admin']));

create policy ic_entitlement_select on public.ic_service_entitlements for select using (public.ic_is_member(organization_id));
create policy ic_entitlement_manage on public.ic_service_entitlements for all using (public.ic_has_role(organization_id,array['owner','admin'])) with check (public.ic_has_role(organization_id,array['owner','admin']));

create policy ic_audit_select on public.ic_audit_events for select using (public.ic_has_role(organization_id,array['owner','admin','manager']));
create policy ic_audit_insert on public.ic_audit_events for insert with check (actor_user_id = auth.uid() and public.ic_is_member(organization_id));
