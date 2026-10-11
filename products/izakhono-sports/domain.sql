-- IZAKHONO SPORTS core domain v1
-- PostgreSQL-compatible, sport-agnostic foundation.

create extension if not exists pgcrypto;

create table if not exists sports (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  rules_version text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  display_name text not null,
  locale text not null default 'en-ZA',
  timezone text not null default 'Africa/Johannesburg',
  created_at timestamptz not null default now()
);

create table if not exists organisations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  organisation_type text not null check (organisation_type in ('club','academy','school','league','federation','venue','agency','sponsor','media','other')),
  country_code char(2),
  currency_code char(3) not null default 'ZAR',
  created_at timestamptz not null default now()
);

create table if not exists organisation_members (
  organisation_id uuid not null references organisations(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  primary key (organisation_id, user_id)
);

create table if not exists athletes (
  id uuid primary key default gen_random_uuid(),
  sports_id uuid not null references sports(id),
  sports_uid text unique not null,
  user_id uuid references users(id),
  legal_name text not null,
  public_name text,
  date_of_birth date,
  nationality text,
  safeguarding_status text not null default 'unknown',
  created_at timestamptz not null default now()
);

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references organisations(id),
  sport_id uuid not null references sports(id),
  name text not null,
  age_band text,
  gender_category text,
  created_at timestamptz not null default now()
);

create table if not exists team_members (
  team_id uuid not null references teams(id) on delete cascade,
  athlete_id uuid not null references athletes(id) on delete cascade,
  role text not null default 'athlete',
  valid_from date,
  valid_to date,
  primary key (team_id, athlete_id, valid_from)
);

create table if not exists seasons (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references sports(id),
  name text not null,
  starts_on date,
  ends_on date
);

create table if not exists competitions (
  id uuid primary key default gen_random_uuid(),
  sport_id uuid not null references sports(id),
  organisation_id uuid references organisations(id),
  season_id uuid references seasons(id),
  name text not null,
  competition_type text not null default 'league',
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table if not exists competition_participants (
  competition_id uuid not null references competitions(id) on delete cascade,
  team_id uuid not null references teams(id),
  seed integer,
  primary key (competition_id, team_id)
);

create table if not exists venues (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  name text not null,
  city text,
  country_code char(2),
  timezone text
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid references competitions(id),
  venue_id uuid references venues(id),
  starts_at timestamptz not null,
  status text not null default 'scheduled',
  metadata jsonb not null default '{}'
);

create table if not exists event_participants (
  event_id uuid not null references events(id) on delete cascade,
  team_id uuid references teams(id),
  athlete_id uuid references athletes(id),
  participant_role text not null,
  primary key (event_id, team_id, athlete_id)
);

create table if not exists results (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  participant_key text not null,
  score numeric,
  placing integer,
  result_payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists athlete_achievements (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  event_id uuid references events(id),
  title text not null,
  achievement_type text,
  evidence_uri text,
  achieved_at timestamptz
);

create table if not exists sponsor_profiles (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid unique not null references organisations(id) on delete cascade,
  objectives jsonb not null default '{}',
  sectors text[] not null default '{}',
  target_markets text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists sponsorship_inventory (
  id uuid primary key default gen_random_uuid(),
  owner_organisation_id uuid not null references organisations(id),
  sport_id uuid references sports(id),
  competition_id uuid references competitions(id),
  team_id uuid references teams(id),
  athlete_id uuid references athletes(id),
  inventory_type text not null,
  description text not null,
  audience_definition jsonb not null default '{}',
  asking_value numeric,
  currency_code char(3) not null default 'ZAR',
  availability_start timestamptz,
  availability_end timestamptz,
  status text not null default 'available'
);

create table if not exists sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  sponsor_organisation_id uuid not null references organisations(id),
  name text not null,
  objective text,
  budget numeric,
  currency_code char(3) not null,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'draft'
);

create table if not exists campaign_activations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references sponsor_campaigns(id) on delete cascade,
  inventory_id uuid not null references sponsorship_inventory(id),
  contracted_value numeric,
  status text not null default 'planned',
  deliverables jsonb not null default '{}'
);

create table if not exists activation_evidence (
  id uuid primary key default gen_random_uuid(),
  activation_id uuid not null references campaign_activations(id) on delete cascade,
  evidence_type text not null,
  evidence_uri text,
  measured_at timestamptz not null default now(),
  metrics jsonb not null default '{}',
  verified boolean not null default false
);

create table if not exists financial_ledger (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid references organisations(id),
  campaign_id uuid references sponsor_campaigns(id),
  transaction_type text not null,
  amount numeric not null,
  currency_code char(3) not null,
  provider text,
  provider_reference text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_events_starts_at on events(starts_at);
create index if not exists idx_inventory_status on sponsorship_inventory(status);
create index if not exists idx_campaigns_status on sponsor_campaigns(status);
create index if not exists idx_evidence_activation on activation_evidence(activation_id);
