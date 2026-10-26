-- IZAKHONO COMMUNICATIONS OS™ M1
-- Control-plane schema baseline.
-- Proprietary IZAKHONO orchestration/data model; third-party runtime/carrier code is external.

create extension if not exists pgcrypto;

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'pending' check (status in ('pending','active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  email text not null,
  display_name text,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table if not exists extensions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  extension text not null,
  display_name text,
  user_id uuid references users(id) on delete set null,
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  unique (tenant_id, extension)
);

create table if not exists devices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  extension_id uuid not null references extensions(id) on delete cascade,
  device_type text not null check (device_type in ('sip','webrtc','mobile','desktop')),
  label text,
  credential_ref text,
  status text not null default 'pending' check (status in ('pending','active','revoked')),
  created_at timestamptz not null default now()
);

create table if not exists phone_numbers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  e164 text not null unique,
  carrier_connection_id uuid,
  status text not null default 'available' check (status in ('available','reserved','active','released','porting')),
  created_at timestamptz not null default now()
);

create table if not exists carrier_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  provider_name text not null,
  adapter_key text not null,
  credential_ref text,
  status text not null default 'pending' check (status in ('pending','healthy','degraded','disabled')),
  created_at timestamptz not null default now()
);

alter table phone_numbers
  add constraint phone_numbers_carrier_fk
  foreign key (carrier_connection_id) references carrier_connections(id) on delete set null;

create table if not exists routing_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  direction text not null check (direction in ('inbound','outbound','both')),
  match_pattern text,
  destination_type text not null check (destination_type in ('extension','ivr','queue','number','voicemail','external')),
  destination_ref text not null,
  priority integer not null default 100,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists ivr_menus (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  greeting_ref text,
  timeout_seconds integer not null default 10,
  retries integer not null default 2,
  options jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists queues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  strategy text not null default 'ring_all' check (strategy in ('ring_all','round_robin','least_recent','least_calls')),
  timeout_seconds integer not null default 30,
  member_extensions text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table if not exists call_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound','internal')),
  from_number text,
  to_number text,
  source_extension text,
  destination_extension text,
  carrier_connection_id uuid references carrier_connections(id) on delete set null,
  started_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  disposition text,
  metadata jsonb not null default '{}'::jsonb
);

create table if not exists recordings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  call_record_id uuid not null references call_records(id) on delete cascade,
  storage_ref text not null,
  retention_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists provisioning_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  job_type text not null,
  idempotency_key text not null unique,
  state text not null default 'requested' check (state in ('requested','payment_confirmed','tenant_created','number_assigned','extensions_created','routing_configured','devices_issued','service_validated','active','requires_attention')),
  attempt_count integer not null default 0,
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan_code text not null,
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id) on delete cascade,
  actor_type text not null,
  actor_id uuid,
  action text not null,
  resource_type text,
  resource_id uuid,
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_tenant on users(tenant_id);
create index if not exists idx_extensions_tenant on extensions(tenant_id);
create index if not exists idx_devices_tenant on devices(tenant_id);
create index if not exists idx_numbers_tenant on phone_numbers(tenant_id);
create index if not exists idx_routes_tenant on routing_rules(tenant_id);
create index if not exists idx_calls_tenant_started on call_records(tenant_id, started_at desc);
create index if not exists idx_audit_tenant_created on audit_events(tenant_id, created_at desc);
create index if not exists idx_jobs_state on provisioning_jobs(state, created_at);
