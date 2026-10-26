-- IZAKHONO BUSINESS ENGINE execution queue
-- Apply through the chosen IZAKHONO/Supabase database after verifying the target project.

create table if not exists public.execution_jobs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id uuid null,
  job_type text not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  attempts integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  error text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null
);

create table if not exists public.execution_job_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.execution_jobs(id) on delete cascade,
  step_key text not null,
  title text not null,
  provider text not null,
  action text not null,
  position integer not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','skipped')),
  result jsonb null,
  error text null,
  created_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  unique(job_id, step_key)
);

create index if not exists execution_jobs_queue_idx
  on public.execution_jobs(status, created_at);

create index if not exists execution_job_steps_queue_idx
  on public.execution_job_steps(job_id, status, position);

alter table public.execution_jobs enable row level security;
alter table public.execution_job_steps enable row level security;

-- Service-role workers bypass RLS. Customer-facing reads/writes should be added
-- only after the workspace ownership/auth contract is finalized.
