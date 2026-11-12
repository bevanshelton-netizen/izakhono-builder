-- IZAKHONO CONNECT AI automation foundation.
-- Requires the existing I-CONNECT organisation and ic_private membership helpers.
create table public.ic_channel_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  provider text not null check (provider in ('whatsapp','instagram','facebook_messenger','telegram','website_chat','email','sms')),
  display_name text not null,
  external_account_id text,
  status text not null default 'draft' check (status in ('draft','pending_verification','active','paused','error','revoked')),
  credential_ref text,
  settings jsonb not null default '{}'::jsonb,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider, external_account_id)
);
create index ic_channel_connections_org_status_idx on public.ic_channel_connections (organization_id, status);

create table public.ic_workflows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('draft','active','paused','archived')),
  current_version integer not null default 1 check (current_version > 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id)
);
create index ic_workflows_org_status_idx on public.ic_workflows (organization_id, status);

create table public.ic_workflow_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  workflow_id uuid not null,
  version integer not null check (version > 0),
  graph jsonb not null default '{"nodes":[],"edges":[]}'::jsonb,
  validation_state text not null default 'draft' check (validation_state in ('draft','valid','blocked')),
  validation_report jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (workflow_id, version),
  foreign key (organization_id, workflow_id) references public.ic_workflows(organization_id, id) on delete cascade
);
create index ic_workflow_versions_org_workflow_idx on public.ic_workflow_versions (organization_id, workflow_id, version desc);

create table public.ic_workflow_runs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.ic_organizations(id) on delete cascade,
  workflow_id uuid not null,
  workflow_version integer not null,
  trigger_type text not null,
  trigger_reference text,
  status text not null default 'queued' check (status in ('queued','running','waiting','completed','failed','cancelled','needs_human')),
  idempotency_key text,
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  error jsonb not null default '{}'::jsonb,
  attempts integer not null default 0 check (attempts >= 0),
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, workflow_id) references public.ic_workflows(organization_id, id) on delete cascade
);
create index ic_workflow_runs_org_created_idx on public.ic_workflow_runs (organization_id, created_at desc);
create index ic_workflow_runs_queue_idx on public.ic_workflow_runs (status, scheduled_at, created_at);

create table public.ic_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_event_id text not null,
  connection_id uuid references public.ic_channel_connections(id) on delete set null,
  organization_id uuid references public.ic_organizations(id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  signature_verified boolean not null default false,
  processing_state text not null default 'received' check (processing_state in ('received','processing','processed','retry','rejected','dead_letter')),
  attempts integer not null default 0 check (attempts >= 0),
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  unique (provider, provider_event_id)
);
create index ic_webhook_events_state_idx on public.ic_webhook_events (processing_state, received_at);

alter table public.ic_channel_connections enable row level security;
alter table public.ic_workflows enable row level security;
alter table public.ic_workflow_versions enable row level security;
alter table public.ic_workflow_runs enable row level security;
alter table public.ic_webhook_events enable row level security;

create policy ic_channel_read on public.ic_channel_connections for select to authenticated using (ic_private.is_member(organization_id));
create policy ic_channel_manage_insert on public.ic_channel_connections for insert to authenticated with check (ic_private.has_role(organization_id, array['owner','admin','manager']));
create policy ic_channel_manage_update on public.ic_channel_connections for update to authenticated using (ic_private.has_role(organization_id, array['owner','admin','manager'])) with check (ic_private.has_role(organization_id, array['owner','admin','manager']));
create policy ic_channel_manage_delete on public.ic_channel_connections for delete to authenticated using (ic_private.has_role(organization_id, array['owner','admin']));

create policy ic_workflow_read on public.ic_workflows for select to authenticated using (ic_private.is_member(organization_id));
create policy ic_workflow_manage_insert on public.ic_workflows for insert to authenticated with check (ic_private.has_role(organization_id, array['owner','admin','manager']));
create policy ic_workflow_manage_update on public.ic_workflows for update to authenticated using (ic_private.has_role(organization_id, array['owner','admin','manager'])) with check (ic_private.has_role(organization_id, array['owner','admin','manager']));
create policy ic_workflow_manage_delete on public.ic_workflows for delete to authenticated using (ic_private.has_role(organization_id, array['owner','admin']));

create policy ic_workflow_version_read on public.ic_workflow_versions for select to authenticated using (ic_private.is_member(organization_id));
create policy ic_workflow_version_insert on public.ic_workflow_versions for insert to authenticated with check (ic_private.has_role(organization_id, array['owner','admin','manager']));
create policy ic_workflow_version_delete on public.ic_workflow_versions for delete to authenticated using (ic_private.has_role(organization_id, array['owner','admin']));

create policy ic_workflow_run_read on public.ic_workflow_runs for select to authenticated using (ic_private.is_member(organization_id));
-- Deliberately no browser write policy for runs.
-- Deliberately no browser policy for webhook events; trusted server ingestion only.
comment on table public.ic_webhook_events is 'Server-only webhook inbox. Verify provider signatures before trusted ingestion; browser access is intentionally denied.';
comment on column public.ic_channel_connections.credential_ref is 'Reference to a private server-side secret; never place credentials in this column or settings JSON.';
