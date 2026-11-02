-- IZAKHONO STREAM — durable entitlement persistence V1
-- Reference migration for the server-side Supabase/Postgres adapter.
-- Not applied to any remote project by this repository change.

create table if not exists public.stream_webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  provider text not null,
  event_id text not null,
  signature_verified boolean not null default false,
  payload jsonb not null,
  status text not null check (status in ('RECEIVED','PROCESSED','REJECTED','FAILED')),
  received_at timestamptz not null,
  processed_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  unique (tenant_id, provider, event_id)
);

create table if not exists public.stream_entitlements (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  user_id text not null,
  product_type text not null check (product_type in ('PLAN','ASSET','EVENT','CHANNEL')),
  product_id text not null,
  source text not null,
  source_event_id text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null check (status in ('ACTIVE','REVOKED')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id, product_type, product_id, source)
);

create table if not exists public.stream_entitlement_audit (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  entitlement_id uuid references public.stream_entitlements(id) on delete set null,
  webhook_event_id uuid references public.stream_webhook_events(id) on delete set null,
  action text not null,
  previous_status text,
  new_status text,
  reason text,
  occurred_at timestamptz not null default now()
);

create index if not exists stream_webhook_events_tenant_status_idx
  on public.stream_webhook_events (tenant_id, status);
create index if not exists stream_entitlements_lookup_idx
  on public.stream_entitlements (tenant_id, user_id, product_type, product_id, status);
create index if not exists stream_entitlements_rights_idx
  on public.stream_entitlements (tenant_id, user_id, starts_at, ends_at, status);
create index if not exists stream_entitlement_audit_tenant_time_idx
  on public.stream_entitlement_audit (tenant_id, occurred_at desc);

alter table public.stream_webhook_events enable row level security;
alter table public.stream_entitlements enable row level security;
alter table public.stream_entitlement_audit enable row level security;

-- These tables are server-side control-plane state. Do not expose them to browser roles.
revoke all on table public.stream_webhook_events from anon, authenticated;
revoke all on table public.stream_entitlements from anon, authenticated;
revoke all on table public.stream_entitlement_audit from anon, authenticated;

comment on table public.stream_webhook_events is 'Durable tenant-scoped webhook replay/idempotency boundary for IZAKHONO STREAM.';
comment on table public.stream_entitlements is 'Authoritative playback entitlement state; payment providers are event sources only.';
comment on table public.stream_entitlement_audit is 'Append-only audit trail for entitlement state transitions.';
