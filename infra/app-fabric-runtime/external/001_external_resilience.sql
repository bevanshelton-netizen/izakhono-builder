create table if not exists public.izakhono_fabric_external_events (
  id uuid primary key default gen_random_uuid(),
  received_at timestamptz not null default now(),
  entity_id text not null,
  platform_id text not null,
  event_type text not null,
  subject_ref text not null,
  stage text not null,
  dedupe_key text not null unique,
  contact jsonb not null default '{}'::jsonb,
  opportunity jsonb not null default '{}'::jsonb,
  note text not null default '',
  source_origin text not null default '',
  status text not null default 'queued'
);

create index if not exists idx_izakhono_fabric_external_events_platform
  on public.izakhono_fabric_external_events (platform_id, received_at desc);
create index if not exists idx_izakhono_fabric_external_events_status
  on public.izakhono_fabric_external_events (status, received_at);

create table if not exists public.izakhono_fabric_external_opportunities (
  id uuid primary key default gen_random_uuid(),
  entity_id text not null,
  platform_id text not null,
  external_ref text not null,
  title text not null default '',
  stage text not null,
  value numeric not null default 0,
  currency text not null default 'ZAR',
  contact jsonb not null default '{}'::jsonb,
  last_event_type text not null,
  source_origin text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(entity_id, platform_id, external_ref)
);

create index if not exists idx_izakhono_fabric_external_opportunities_stage
  on public.izakhono_fabric_external_opportunities (platform_id, stage, updated_at desc);

alter table public.izakhono_fabric_external_events enable row level security;
alter table public.izakhono_fabric_external_opportunities enable row level security;
