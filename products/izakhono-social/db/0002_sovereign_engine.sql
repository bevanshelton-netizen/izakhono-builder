create unique index if not exists accounts_email_lower_uidx
  on accounts ((lower(email)))
  where email is not null and status <> 'deleted';

create table if not exists password_credentials (
  account_id uuid primary key references accounts(id) on delete cascade,
  password_salt text not null,
  password_hash text not null,
  changed_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  token_hash char(64) not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz not null default now()
);

create index if not exists sessions_account_active_idx
  on sessions(account_id, expires_at desc)
  where revoked_at is null;

create unique index if not exists reactions_post_unique_idx
  on reactions(actor_id, post_id, kind)
  where post_id is not null;

create unique index if not exists reactions_comment_unique_idx
  on reactions(actor_id, comment_id, kind)
  where comment_id is not null;

create table if not exists rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null default 0 check (hit_count >= 0)
);

comment on table rate_limit_buckets is
  'Abuse-prevention counters only. Do not use for behavioural profiling, advertising or feed ranking.';
