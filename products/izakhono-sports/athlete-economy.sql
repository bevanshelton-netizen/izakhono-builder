-- IZAKHONO SPORTS Athlete Economy / Sports ID v1
create table if not exists athlete_profiles (
  athlete_id uuid primary key references athletes(id) on delete cascade,
  headline text,
  bio text,
  sports text[] not null default '{}',
  positions text[] not null default '{}',
  home_country char(2),
  visibility text not null default 'public' check (visibility in ('public','network','private')),
  sponsorship_ready boolean not null default false,
  scouting_ready boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists athlete_verifications (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references athletes(id) on delete cascade,
  verification_type text not null,
  verified_by uuid references users(id),
  evidence_uri text,
  status text not null default 'pending' check (status in ('pending','verified','rejected','expired')),
  verified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists athlete_commercial_profiles (
  athlete_id uuid primary key references athletes(id) on delete cascade,
  categories text[] not null default '{}',
  markets text[] not null default '{}',
  audience text[] not null default '{}',
  rate_card jsonb not null default '{}',
  contact_preferences jsonb not null default '{}',
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index if not exists idx_athlete_verifications_status on athlete_verifications(athlete_id,status);
create index if not exists idx_athlete_profiles_visibility on athlete_profiles(visibility);
