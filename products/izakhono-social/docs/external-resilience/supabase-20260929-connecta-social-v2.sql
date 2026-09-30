-- IZAKHONO SOCIAL / CONNECTA social-v2 additive schema extension
-- Applied to IZAKHONO WebStart on 2026-09-29.
-- Existing CONNECTA tables and actions remain authoritative and backward-compatible.

alter table public.connecta_accounts
  add column if not exists bio text not null default '',
  add column if not exists avatar_url text,
  add column if not exists banner_url text,
  add column if not exists location text not null default '',
  add column if not exists website text not null default '',
  add column if not exists verified boolean not null default false,
  add column if not exists account_type text not null default 'person';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='connecta_accounts_account_type_check') then
    alter table public.connecta_accounts add constraint connecta_accounts_account_type_check
      check (account_type in ('person','creator','business','organisation'));
  end if;
end $$;

alter table public.connecta_posts
  add column if not exists parent_post_id uuid references public.connecta_posts(id) on delete cascade,
  add column if not exists repost_of_id uuid references public.connecta_posts(id) on delete cascade,
  add column if not exists quote_post_id uuid references public.connecta_posts(id) on delete set null,
  add column if not exists language text not null default 'und',
  add column if not exists edited_at timestamptz;

create table if not exists public.connecta_follows (
  follower_id uuid not null references public.connecta_accounts(id) on delete cascade,
  following_id uuid not null references public.connecta_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint connecta_follows_no_self check (follower_id <> following_id)
);

create table if not exists public.connecta_bookmarks (
  account_id uuid not null references public.connecta_accounts(id) on delete cascade,
  post_id uuid not null references public.connecta_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, post_id)
);

create table if not exists public.connecta_conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'direct' check (kind in ('direct','group')),
  created_by uuid not null references public.connecta_accounts(id) on delete cascade,
  title text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.connecta_conversation_members (
  conversation_id uuid not null references public.connecta_conversations(id) on delete cascade,
  account_id uuid not null references public.connecta_accounts(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id, account_id)
);

create table if not exists public.connecta_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.connecta_conversations(id) on delete cascade,
  sender_id uuid not null references public.connecta_accounts(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 8000),
  moderation_state text not null default 'allowed' check (moderation_state in ('allowed','review','blocked')),
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.connecta_blocks (
  blocker_id uuid not null references public.connecta_accounts(id) on delete cascade,
  blocked_id uuid not null references public.connecta_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint connecta_blocks_no_self check (blocker_id <> blocked_id)
);

create table if not exists public.connecta_mutes (
  account_id uuid not null references public.connecta_accounts(id) on delete cascade,
  muted_account_id uuid not null references public.connecta_accounts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, muted_account_id),
  constraint connecta_mutes_no_self check (account_id <> muted_account_id)
);

create index if not exists connecta_posts_parent_idx on public.connecta_posts(parent_post_id, created_at);
create index if not exists connecta_posts_repost_idx on public.connecta_posts(repost_of_id, created_at);
create index if not exists connecta_posts_quote_idx on public.connecta_posts(quote_post_id);
create index if not exists connecta_follows_following_idx on public.connecta_follows(following_id, created_at desc);
create index if not exists connecta_bookmarks_account_idx on public.connecta_bookmarks(account_id, created_at desc);
create index if not exists connecta_conversation_members_account_idx on public.connecta_conversation_members(account_id, joined_at desc);
create index if not exists connecta_messages_conversation_idx on public.connecta_messages(conversation_id, created_at desc);
create index if not exists connecta_blocks_blocked_idx on public.connecta_blocks(blocked_id);
create index if not exists connecta_mutes_muted_idx on public.connecta_mutes(muted_account_id);

alter table public.connecta_follows enable row level security;
alter table public.connecta_bookmarks enable row level security;
alter table public.connecta_conversations enable row level security;
alter table public.connecta_conversation_members enable row level security;
alter table public.connecta_messages enable row level security;
alter table public.connecta_blocks enable row level security;
alter table public.connecta_mutes enable row level security;

revoke all on table public.connecta_follows from anon, authenticated;
revoke all on table public.connecta_bookmarks from anon, authenticated;
revoke all on table public.connecta_conversations from anon, authenticated;
revoke all on table public.connecta_conversation_members from anon, authenticated;
revoke all on table public.connecta_messages from anon, authenticated;
revoke all on table public.connecta_blocks from anon, authenticated;
revoke all on table public.connecta_mutes from anon, authenticated;

comment on table public.connecta_follows is 'IZAKHONO SOCIAL relationship graph; server-mediated only.';
comment on table public.connecta_bookmarks is 'IZAKHONO SOCIAL private saved-post state; server-mediated only.';
comment on table public.connecta_messages is 'IZAKHONO SOCIAL private-message store; server-mediated only.';
