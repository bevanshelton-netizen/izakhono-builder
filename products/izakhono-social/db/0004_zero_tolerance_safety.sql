-- CONNECTA zero-tolerance safety, anti-cyberbullying and anti-cloning controls.

create table if not exists safety_blocks (
  blocker_id uuid not null references accounts(id) on delete cascade,
  blocked_id uuid not null references accounts(id) on delete cascade,
  source text not null default 'user' check (source in ('user','report','moderation','system')),
  reason text not null default '',
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists account_enforcements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  moderation_case_id uuid references moderation_cases(id) on delete set null,
  report_id uuid references reports(id) on delete set null,
  category text not null,
  action text not null check (action in ('protective_lock','disabled','restored')),
  state text not null default 'active' check (state in ('active','reversed','expired')),
  rationale text not null default '',
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index if not exists account_enforcements_account_idx
  on account_enforcements(account_id, created_at desc);

create table if not exists safety_notices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  moderation_case_id uuid references moderation_cases(id) on delete set null,
  notice_type text not null check (notice_type in ('protective_lock','formal_violation_warning','restoration')),
  title text not null,
  body text not null,
  delivered_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists safety_notices_account_idx
  on safety_notices(account_id, delivered_at desc);

create table if not exists protected_identities (
  account_id uuid primary key references accounts(id) on delete cascade,
  handle_skeleton text not null,
  display_name_skeleton text not null,
  avatar_sha256 text,
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified','reviewed','verified')),
  protected boolean not null default true,
  protected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists protected_identities_handle_idx
  on protected_identities(handle_skeleton)
  where protected=true;

create index if not exists protected_identities_display_idx
  on protected_identities(display_name_skeleton)
  where protected=true;

create table if not exists identity_alerts (
  id uuid primary key default gen_random_uuid(),
  suspected_account_id uuid references accounts(id) on delete cascade,
  protected_account_id uuid not null references accounts(id) on delete cascade,
  signal text not null check (signal in ('handle_similarity','display_name_similarity','avatar_match','user_report')),
  score numeric(5,4) not null default 1 check (score >= 0 and score <= 1),
  state text not null default 'open' check (state in ('open','reviewing','confirmed_clone','cleared')),
  detail text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists identity_alerts_state_idx
  on identity_alerts(state, created_at desc);

comment on table safety_blocks is
  'Safety separation only. Never use for advertising, behavioural profiling or engagement ranking.';
comment on table protected_identities is
  'Anti-impersonation identity protection. Do not expose identity-security metadata publicly.';
