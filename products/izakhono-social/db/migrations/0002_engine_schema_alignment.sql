-- CONNECTA engine/schema alignment migration.
-- Adds the columns and operational tables referenced by the current engine.
-- Safe on fresh databases after 0001 and safe to re-run.

alter table profiles
  add column if not exists cover_key text,
  add column if not exists city text,
  add column if not exists country_code text,
  add column if not exists website text,
  add column if not exists location text,
  add column if not exists discoverable boolean not null default true;

alter table onboarding_state
  add column if not exists profile_complete boolean not null default false,
  add column if not exists activated_at timestamptz,
  add column if not exists first_connection_at timestamptz,
  add column if not exists first_follow_at timestamptz,
  add column if not exists first_community_at timestamptz,
  add column if not exists first_post_at timestamptz,
  add column if not exists first_invite_at timestamptz;

alter table communities
  add column if not exists status text not null default 'active';

alter table comments
  add column if not exists parent_comment_id uuid references comments(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

alter table reactions
  add column if not exists comment_id uuid references comments(id) on delete cascade,
  add column if not exists kind text not null default 'appreciate';

alter table reactions drop constraint if exists reactions_pkey;
alter table reactions add primary key (actor_id, post_id, comment_id, kind);

alter table conversations
  add column if not exists kind text not null default 'direct',
  add column if not exists title text,
  add column if not exists updated_at timestamptz not null default now();

alter table conversation_members
  add column if not exists role text not null default 'member',
  add column if not exists left_at timestamptz,
  add column if not exists last_read_at timestamptz;

alter table messages
  add column if not exists moderation_state text not null default 'allowed',
  add column if not exists deleted_at timestamptz;

alter table media_assets
  add column if not exists moderation_state text not null default 'allowed';

alter table notifications
  add column if not exists kind text,
  add column if not exists actor_id uuid references accounts(id) on delete set null,
  add column if not exists target_type text,
  add column if not exists target_id uuid;

update notifications set kind=coalesce(kind,notification_type) where kind is null;
alter table notifications alter column kind set not null;

alter table safety_blocks
  add column if not exists source text not null default 'user',
  add column if not exists reason text;

alter table safety_notices
  add column if not exists moderation_case_id uuid references moderation_cases(id) on delete set null,
  add column if not exists acknowledged_at timestamptz;

alter table account_enforcements
  add column if not exists moderation_case_id uuid references moderation_cases(id) on delete set null,
  add column if not exists report_id uuid references reports(id) on delete set null,
  add column if not exists category text,
  add column if not exists action text,
  add column if not exists rationale text,
  add column if not exists state text not null default 'active',
  add column if not exists ended_at timestamptz;

alter table appeals
  add column if not exists moderation_case_id uuid references moderation_cases(id) on delete cascade,
  add column if not exists appellant_id uuid references accounts(id) on delete cascade,
  add column if not exists statement text,
  add column if not exists state text not null default 'pending';

alter table reports
  add column if not exists detail text,
  add column if not exists resolved_at timestamptz;

alter table moderation_cases
  add column if not exists source text,
  add column if not exists category text,
  add column if not exists severity integer,
  add column if not exists state text not null default 'open',
  add column if not exists action text,
  add column if not exists rationale text,
  add column if not exists reviewer_subject text;

alter table identity_alerts
  add column if not exists suspected_account_id uuid references accounts(id) on delete cascade,
  add column if not exists protected_account_id uuid references accounts(id) on delete cascade,
  add column if not exists signal text,
  add column if not exists score numeric,
  add column if not exists detail text,
  add column if not exists state text not null default 'open';

alter table protected_identities
  add column if not exists handle_skeleton text,
  add column if not exists display_name_skeleton text,
  add column if not exists verification_state text,
  add column if not exists protected boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

alter table businesses
  add column if not exists trading_name text,
  add column if not exists registration_number text,
  add column if not exists country_code text,
  add column if not exists website text,
  add column if not exists business_email text,
  add column if not exists verification_level text not null default 'basic',
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by text,
  add column if not exists rejection_reason text;

create unique index if not exists uq_businesses_registration_number
  on businesses(registration_number) where registration_number is not null;

create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references accounts(id) on delete cascade,
  code text not null unique,
  label text,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists invite_redemptions (
  invite_id uuid not null references invite_codes(id) on delete cascade,
  invited_account_id uuid not null references accounts(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (invite_id, invited_account_id),
  unique (invited_account_id)
);

create table if not exists community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  inviter_id uuid not null references accounts(id) on delete cascade,
  code text not null unique,
  max_uses integer,
  use_count integer not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists community_invite_redemptions (
  invite_id uuid not null references community_invites(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key (invite_id, account_id)
);

create table if not exists content_shares (
  id uuid primary key default gen_random_uuid(),
  sharer_id uuid not null references accounts(id) on delete cascade,
  owner_id uuid not null references accounts(id) on delete cascade,
  source_type text not null,
  source_id uuid not null,
  commentary text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists content_duplicate_alerts (
  id uuid primary key default gen_random_uuid(),
  original_media_id uuid not null references media_assets(id) on delete cascade,
  original_owner_id uuid not null references accounts(id) on delete cascade,
  suspected_media_id uuid not null references media_assets(id) on delete cascade,
  suspected_owner_id uuid not null references accounts(id) on delete cascade,
  match_type text not null,
  similarity_score numeric,
  phash_distance integer,
  dhash_distance integer,
  algorithm text,
  created_at timestamptz not null default now(),
  unique (original_media_id, suspected_media_id)
);

create table if not exists media_fingerprints (
  media_id uuid primary key references media_assets(id) on delete cascade,
  owner_id uuid not null references accounts(id) on delete cascade,
  algorithm text not null,
  phash_primary text,
  phash_variants jsonb not null default '[]'::jsonb,
  dhash_primary text,
  width integer,
  height integer,
  created_at timestamptz not null default now()
);

create table if not exists business_verification_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  actor_subject text,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists business_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  evidence_type text not null,
  reference text not null,
  checksum_sha256 text,
  state text not null default 'pending',
  reviewer_subject text,
  review_note text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace view connecta_growth_summary as
select
  (select count(*)::bigint from accounts) as accounts,
  (select count(*)::bigint from accounts where status='active') as active_accounts,
  (select count(*)::bigint from posts where deleted_at is null and moderation_state='allowed') as posts,
  (select count(*)::bigint from communities where status='active') as communities,
  (select count(*)::bigint from follows) as follows,
  (select count(*)::bigint from businesses where verification_state='verified') as verified_businesses;

create index if not exists idx_notifications_account_kind_created
  on notifications(account_id,kind,created_at desc);
create index if not exists idx_messages_conversation_created_allowed
  on messages(conversation_id,created_at) where deleted_at is null and moderation_state='allowed';
create index if not exists idx_content_shares_source
  on content_shares(source_type,source_id,created_at desc);
create index if not exists idx_identity_alerts_state_score
  on identity_alerts(state,score desc,created_at);
create index if not exists idx_business_evidence_business_state
  on business_verification_evidence(business_id,state,created_at);
create index if not exists idx_business_events_business_created
  on business_verification_events(business_id,created_at desc);
