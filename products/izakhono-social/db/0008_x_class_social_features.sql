-- CONNECTA / IZAKHONO SOCIAL X-class interaction layer.
-- Additive migration: preserves existing privacy, provenance and safety tables.

alter table profiles
  add column if not exists website text,
  add column if not exists location text;

alter table conversations
  add column if not exists title text not null default '',
  add column if not exists updated_at timestamptz not null default now();

alter table conversation_members
  add column if not exists last_read_at timestamptz;

create table if not exists bookmarks (
  account_id uuid not null references accounts(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, post_id)
);

create index if not exists bookmarks_account_created_idx
  on bookmarks(account_id, created_at desc);

create table if not exists post_reposts (
  actor_id uuid not null references accounts(id) on delete cascade,
  post_id uuid not null references posts(id) on delete cascade,
  commentary text not null default '',
  created_at timestamptz not null default now(),
  primary key (actor_id, post_id)
);

create index if not exists post_reposts_post_created_idx
  on post_reposts(post_id, created_at desc);

create index if not exists follows_followed_created_idx
  on follows(followed_id, created_at desc);

create index if not exists comments_author_created_idx
  on comments(author_id, created_at desc);

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid='notifications'::regclass
      and conname='notifications_kind_check'
  ) then
    alter table notifications drop constraint notifications_kind_check;
  end if;
end $$;

alter table notifications
  add constraint notifications_kind_check check (kind in (
    'content_shared',
    'content_duplicate_detected',
    'business_verification',
    'safety',
    'follow',
    'reply',
    'reaction',
    'message'
  ));

comment on table bookmarks is
  'Private saved-post state. Not used for advertising, behavioural profiling or feed manipulation.';
comment on table post_reposts is
  'Explicit repost graph. Original post ownership is preserved; reposts do not create duplicate ownership.';
