-- IZAKHONO OTT V1 data model
-- Apply only to the designated IZAKHONO OTT database after infrastructure approval.

create extension if not exists pgcrypto;

create table if not exists ott_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  display_name text not null,
  avatar_url text,
  is_kids boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists ott_titles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  synopsis text,
  content_type text not null check (content_type in ('movie','series','episode','music','documentary','kids','event')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  country_code text,
  language_code text,
  artwork_url text,
  playback_asset_id text,
  rights_start timestamptz,
  rights_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ott_channels (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  channel_type text not null check (channel_type in ('live','fast','creator','news','music','sport','faith','kids','culture')),
  status text not null default 'draft' check (status in ('draft','live','offline')),
  logo_url text,
  stream_endpoint_ref text,
  created_at timestamptz not null default now()
);

create table if not exists ott_plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  amount_zar integer not null,
  billing_interval text not null default 'month',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into ott_plans (code,name,amount_zar) values
('free','Free',0),('mobile','Mobile',59),('plus','Plus',159),('premium','Premium',299)
on conflict (code) do nothing;

create table if not exists ott_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid references ott_profiles(id) on delete set null,
  plan_id uuid not null references ott_plans(id),
  provider text,
  provider_reference text,
  status text not null default 'pending' check (status in ('pending','active','past_due','cancelled','expired')),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists ott_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title_id uuid references ott_titles(id) on delete cascade,
  channel_id uuid references ott_channels(id) on delete cascade,
  source text not null check (source in ('subscription','ppv','promo','free','creator')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  check (title_id is not null or channel_id is not null)
);

create table if not exists ott_watch_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  profile_id uuid references ott_profiles(id) on delete cascade,
  title_id uuid not null references ott_titles(id) on delete cascade,
  position_seconds integer not null default 0,
  duration_seconds integer,
  updated_at timestamptz not null default now(),
  unique(profile_id,title_id)
);

create table if not exists ott_watchlist (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references ott_profiles(id) on delete cascade,
  title_id uuid not null references ott_titles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(profile_id,title_id)
);

create table if not exists ott_ppv_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title_id uuid references ott_titles(id) on delete set null,
  channel_id uuid references ott_channels(id) on delete set null,
  amount_zar integer not null,
  payment_reference text,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  created_at timestamptz not null default now()
);

create index if not exists ott_titles_status_idx on ott_titles(status);
create index if not exists ott_titles_type_idx on ott_titles(content_type);
create index if not exists ott_entitlements_user_idx on ott_entitlements(user_id);
create index if not exists ott_history_user_idx on ott_watch_history(user_id);
