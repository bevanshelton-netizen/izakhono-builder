-- IZAKHONO SPORTS Universal Rules Engine v1
-- Versioned, sport-agnostic competition scoring profiles.

create table if not exists rules_profiles (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid references sports(id),
  code text unique not null,
  version text not null,
  name text not null,
  ranking_metric text not null check (ranking_metric in ('points','score','time','distance','placing','custom')),
  placing_points jsonb not null default '{}',
  score_aggregation text not null default 'sum' check (score_aggregation in ('sum','average','max','min','none')),
  tie_breakers jsonb not null default '[]',
  periods jsonb not null default '[]',
  result_schema jsonb not null default '{}',
  status text not null default 'draft' check (status in ('draft','published','retired')),
  created_at timestamptz not null default now(),
  unique(code, version)
);

alter table if exists competitions
  add column if not exists rules_profile_id uuid references rules_profiles(id);

create index if not exists idx_rules_profiles_sport on rules_profiles(sport_id);
create index if not exists idx_competitions_rules_profile on competitions(rules_profile_id);
