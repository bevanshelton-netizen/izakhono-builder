-- IZAKHONO CALLBACK v1 — core schema proposal
-- Review and apply only through a controlled migration after confirming tenant/auth model.
-- Public clients must NOT receive unrestricted table access. Server-side service-role use only.
create extension if not exists pgcrypto;

create schema if not exists callback_private;

create table if not exists public.callback_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  organisation_name text not null default 'Edu-Build Institute',
  full_name text not null check (char_length(full_name) between 2 and 160),
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email text,
  interest_code text not null default 'unsure',
  campus_or_area text,
  preferred_window text,
  source_channel text not null default 'website',
  campaign_id text,
  external_reference text,
  request_status text not null default 'received'
    check (request_status in ('received','needs_review','queued','scheduled','calling','connected','no_answer','busy','failed','reschedule_requested','appointment_booked','application_started','converted','human_follow_up','cancelled','opted_out')),
  assigned_team text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists callback_requests_tenant_created_idx
  on public.callback_requests (tenant_id, created_at desc);
create index if not exists callback_requests_phone_idx
  on public.callback_requests (phone_e164);
create index if not exists callback_requests_status_idx
  on public.callback_requests (tenant_id, request_status, created_at);

create table if not exists public.callback_consent_events (
  id uuid primary key default gen_random_uuid(),
  callback_request_id uuid not null references public.callback_requests(id) on delete cascade,
  purpose text not null,
  channel text not null,
  notice_version text not null,
  affirmative_action text not null,
  evidence_type text not null,
  evidence_reference text,
  status text not null check (status in ('granted','declined','withdrawn','superseded')),
  occurred_at timestamptz not null default now(),
  captured_by text
);
create index if not exists callback_consent_request_time_idx
  on public.callback_consent_events (callback_request_id, occurred_at desc);

create table if not exists public.callback_jobs (
  id uuid primary key default gen_random_uuid(),
  callback_request_id uuid not null references public.callback_requests(id) on delete cascade,
  scheduled_at timestamptz,
  timezone text not null default 'Africa/Johannesburg',
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 10),
  status text not null default 'queued'
    check (status in ('queued','scheduled','claimed','calling','completed','retry_wait','cancelled','failed')),
  provider_adapter text,
  provider_call_id text,
  last_error_code text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists callback_jobs_due_idx
  on public.callback_jobs (status, scheduled_at);

create table if not exists public.callback_outcomes (
  id uuid primary key default gen_random_uuid(),
  callback_job_id uuid not null references public.callback_jobs(id) on delete cascade,
  outcome_code text not null,
  summary text,
  appointment_reference text,
  next_action_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists callback_outcomes_job_idx
  on public.callback_outcomes (callback_job_id, created_at desc);

create table if not exists public.callback_suppressions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  phone_e164 text,
  email text,
  scope text not null default 'all_calls'
    check (scope in ('all_calls','marketing','specific_campaign')),
  reason text not null,
  created_at timestamptz not null default now(),
  check (phone_e164 is not null or email is not null)
);
create index if not exists callback_suppressions_tenant_phone_idx
  on public.callback_suppressions (tenant_id, phone_e164);

-- Privacy-first defaults: RLS enabled and no anon/authenticated policies granted here.
-- Add reviewed, tenant-scoped policies only after the application's identity model is confirmed.
alter table public.callback_requests enable row level security;
alter table public.callback_consent_events enable row level security;
alter table public.callback_jobs enable row level security;
alter table public.callback_outcomes enable row level security;
alter table public.callback_suppressions enable row level security;

comment on table public.callback_requests is 'IZAKHONO CALLBACK: customer-requested call leads; do not expose publicly.';
comment on table public.callback_consent_events is 'Audit evidence for purpose-specific callback/marketing permissions and withdrawals.';
comment on table public.callback_jobs is 'Callback scheduling and provider-neutral job lifecycle; no arbitrary public dial endpoint.';
comment on table public.callback_outcomes is 'Minimal callback outcomes and follow-up actions.';
comment on table public.callback_suppressions is 'Tenant-specific suppression/opt-out records; check before every outbound attempt.';
