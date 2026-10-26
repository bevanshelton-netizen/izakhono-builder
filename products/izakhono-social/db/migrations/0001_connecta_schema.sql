-- CONNECTA canonical PostgreSQL bootstrap schema.
-- Safe to apply to a fresh database. Existing production databases must be
-- migrated through an explicit versioned migration process before rollout.

create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique,
  email text not null unique,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  account_id uuid primary key references accounts(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  avatar_key text,
  visibility text not null default 'public',
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists password_credentials (
  account_id uuid primary key references accounts(id) on delete cascade,
  password_salt text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists onboarding_state (
  account_id uuid primary key references accounts(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists follows (
  follower_id uuid not null references accounts(id) on delete cascade,
  followed_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table if not exists connections (
  requester_id uuid not null references accounts(id) on delete cascade,
  addressee_id uuid not null references accounts(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references accounts(id),
  name text not null,
  slug text not null unique,
  description text,
  visibility text not null default 'public',
  created_at timestamptz not null default now()
);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  status text not null default 'active',
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (community_id, account_id)
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references accounts(id),
  body text not null,
  visibility text not null default 'public',
  moderation_state text not null default 'allowed',
  community_id uuid references communities(id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references accounts(id),
  body text not null,
  moderation_state text not null default 'allowed',
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists reactions (
  post_id uuid not null references posts(id) on delete cascade,
  actor_id uuid not null references accounts(id) on delete cascade,
  reaction_type text not null default 'like',
  created_at timestamptz not null default now(),
  primary key (post_id, actor_id, reaction_type)
);

create table if not exists post_reposts (
  post_id uuid not null references posts(id) on delete cascade,
  actor_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, actor_id)
);

create table if not exists bookmarks (
  post_id uuid not null references posts(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, account_id)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, account_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references accounts(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references accounts(id),
  storage_key text not null unique,
  mime_type text,
  byte_size bigint,
  sha256 text,
  perceptual_fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists post_media (
  post_id uuid not null references posts(id) on delete cascade,
  media_id uuid not null references media_assets(id) on delete cascade,
  position integer not null default 0,
  primary key (post_id, media_id)
);

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references accounts(id) on delete cascade,
  legal_name text,
  display_name text,
  verification_state text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists rate_limit_buckets (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null default 0
);

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_subject uuid,
  event_type text not null,
  target_type text,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists safety_blocks (
  blocker_id uuid not null references accounts(id) on delete cascade,
  blocked_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table if not exists safety_notices (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  notice_type text not null,
  title text not null,
  body text,
  delivered_at timestamptz not null default now()
);

create table if not exists account_enforcements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  enforcement_type text not null,
  status text not null default 'active',
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists appeals (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  body text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references accounts(id),
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists moderation_cases (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete set null,
  target_type text,
  target_id uuid,
  status text not null default 'open',
  decision text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identity_alerts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references accounts(id) on delete cascade,
  alert_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists protected_identities (
  account_id uuid primary key references accounts(id) on delete cascade,
  protected_handle text not null,
  created_at timestamptz not null default now()
);

create table if not exists media_assets_fingerprints (
  media_id uuid primary key references media_assets(id) on delete cascade,
  sha256 text,
  perceptual_fingerprint text,
  created_at timestamptz not null default now()
);

create table if not exists business_verifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  status text not null default 'pending',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  evidence_type text not null,
  evidence jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_posts_author_created on posts(author_id, created_at desc);
create index if not exists idx_posts_created on posts(created_at desc);
create index if not exists idx_comments_post_created on comments(post_id, created_at);
create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at);
create index if not exists idx_notifications_account_created on notifications(account_id, created_at desc);
create index if not exists idx_reports_status on reports(status, created_at);
create index if not exists idx_moderation_cases_status on moderation_cases(status, created_at);
