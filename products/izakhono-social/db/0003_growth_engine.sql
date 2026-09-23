create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references accounts(id) on delete cascade,
  code text not null unique,
  label text not null default '',
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists invite_codes_owner_created_idx
  on invite_codes(owner_id, created_at desc);

create table if not exists invite_redemptions (
  invite_id uuid not null references invite_codes(id) on delete cascade,
  invited_account_id uuid not null references accounts(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  primary key(invite_id, invited_account_id)
);

create unique index if not exists invite_redemptions_account_uidx
  on invite_redemptions(invited_account_id);

create table if not exists onboarding_state (
  account_id uuid primary key references accounts(id) on delete cascade,
  profile_complete boolean not null default false,
  first_connection_at timestamptz,
  first_follow_at timestamptz,
  first_community_at timestamptz,
  first_post_at timestamptz,
  first_invite_at timestamptz,
  activated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  inviter_id uuid not null references accounts(id) on delete cascade,
  code text not null unique,
  max_uses integer check (max_uses is null or max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace view connecta_growth_summary as
select
  (select count(*) from accounts where status='active') as active_accounts,
  (select count(*) from profiles) as profiles,
  (select count(*) from communities where status='active') as active_communities,
  (select count(*) from posts where deleted_at is null and moderation_state='allowed') as published_posts,
  (select count(*) from onboarding_state where activated_at is not null) as activated_accounts,
  (select count(*) from invite_codes where active=true) as active_invite_codes,
  (select count(*) from invite_redemptions) as invite_redemptions;

comment on view connecta_growth_summary is
  'Aggregate operational growth metrics only. No behavioural profiling, cross-site identifiers or per-user engagement scoring.';
