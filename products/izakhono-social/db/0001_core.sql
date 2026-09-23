create extension if not exists pgcrypto;

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  auth_subject text not null unique,
  email text,
  status text not null default 'active' check (status in ('active','restricted','suspended','deleted')),
  birth_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  account_id uuid primary key references accounts(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  bio text not null default '',
  avatar_key text,
  cover_key text,
  city text,
  country_code char(2),
  visibility text not null default 'public' check (visibility in ('public','connections','private')),
  discoverable boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists connections (
  requester_id uuid not null references accounts(id) on delete cascade,
  addressee_id uuid not null references accounts(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

create table if not exists follows (
  follower_id uuid not null references accounts(id) on delete cascade,
  followed_id uuid not null references accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

create table if not exists communities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references accounts(id) on delete restrict,
  slug text not null unique,
  name text not null,
  description text not null default '',
  visibility text not null default 'public' check (visibility in ('public','private','hidden')),
  status text not null default 'active' check (status in ('active','restricted','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists community_members (
  community_id uuid not null references communities(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  role text not null default 'member' check (role in ('member','moderator','admin','owner')),
  status text not null default 'active' check (status in ('pending','active','muted','removed','banned')),
  joined_at timestamptz not null default now(),
  primary key (community_id, account_id)
);

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references accounts(id) on delete cascade,
  community_id uuid references communities(id) on delete cascade,
  body text not null default '',
  visibility text not null default 'public' check (visibility in ('public','connections','community','private')),
  moderation_state text not null default 'allowed' check (moderation_state in ('allowed','review','blocked','removed')),
  reply_policy text not null default 'everyone' check (reply_policy in ('everyone','connections','mentioned','off')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists posts_author_created_idx on posts(author_id, created_at desc);
create index if not exists posts_community_created_idx on posts(community_id, created_at desc) where community_id is not null;

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id) on delete cascade,
  author_id uuid not null references accounts(id) on delete cascade,
  parent_comment_id uuid references comments(id) on delete cascade,
  body text not null,
  moderation_state text not null default 'allowed' check (moderation_state in ('allowed','review','blocked','removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists comments_post_created_idx on comments(post_id, created_at);

create table if not exists reactions (
  actor_id uuid not null references accounts(id) on delete cascade,
  post_id uuid references posts(id) on delete cascade,
  comment_id uuid references comments(id) on delete cascade,
  kind text not null check (kind in ('appreciate','support','celebrate','insightful')),
  created_at timestamptz not null default now(),
  check ((post_id is not null)::int + (comment_id is not null)::int = 1),
  unique(actor_id, post_id, comment_id, kind)
);

create table if not exists media_assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references accounts(id) on delete cascade,
  object_key text not null unique,
  media_type text not null check (media_type in ('image','video','audio','document')),
  mime_type text not null,
  byte_size bigint not null check (byte_size >= 0),
  moderation_state text not null default 'pending' check (moderation_state in ('pending','allowed','review','blocked','removed')),
  sha256 text,
  perceptual_hash text,
  created_at timestamptz not null default now()
);

create table if not exists post_media (
  post_id uuid not null references posts(id) on delete cascade,
  media_id uuid not null references media_assets(id) on delete cascade,
  position smallint not null default 0,
  primary key (post_id, media_id)
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),
  created_at timestamptz not null default now()
);

create table if not exists conversation_members (
  conversation_id uuid not null references conversations(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  role text not null default 'member' check (role in ('member','admin')),
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (conversation_id, account_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references accounts(id) on delete cascade,
  body text not null default '',
  moderation_state text not null default 'allowed' check (moderation_state in ('allowed','review','blocked','removed')),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists messages_conversation_created_idx on messages(conversation_id, created_at);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references accounts(id) on delete cascade,
  target_type text not null check (target_type in ('account','post','comment','message','community','media')),
  target_id uuid not null,
  reason text not null,
  detail text not null default '',
  status text not null default 'open' check (status in ('open','triaged','resolved','dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_status_created_idx on reports(status, created_at);

create table if not exists moderation_cases (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('automatic','user_report','trusted_reporter','staff')),
  target_type text not null check (target_type in ('account','post','comment','message','community','media')),
  target_id uuid not null,
  category text not null,
  severity smallint not null default 1 check (severity between 1 and 5),
  state text not null default 'open' check (state in ('open','reviewing','actioned','cleared')),
  action text check (action in ('none','limit','remove','suspend','disable')),
  rationale text not null default '',
  reviewer_subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists appeals (
  id uuid primary key default gen_random_uuid(),
  moderation_case_id uuid not null references moderation_cases(id) on delete cascade,
  appellant_id uuid not null references accounts(id) on delete cascade,
  statement text not null,
  state text not null default 'open' check (state in ('open','reviewing','upheld','reversed')),
  reviewer_subject text,
  decision_note text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table if not exists audit_events (
  id bigserial primary key,
  actor_subject text,
  event_type text not null,
  target_type text,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

comment on table audit_events is 'Security and moderation audit trail only. Never use for behavioural advertising, profiling or engagement surveillance.';
