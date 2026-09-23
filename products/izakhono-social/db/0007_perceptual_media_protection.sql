-- CONNECTA perceptual media protection.
-- High-confidence altered-image signals are review holds, not automatic findings.

create table if not exists media_fingerprints (
  media_id uuid primary key references media_assets(id) on delete cascade,
  owner_id uuid not null references accounts(id) on delete cascade,
  algorithm text not null,
  phash_primary text not null,
  phash_variants jsonb not null default '[]'::jsonb,
  dhash_primary text not null,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now()
);

create index if not exists media_fingerprints_owner_created_idx
  on media_fingerprints(owner_id, created_at desc);

alter table content_duplicate_alerts
  add column if not exists similarity_score numeric(6,5),
  add column if not exists phash_distance integer,
  add column if not exists dhash_distance integer,
  add column if not exists algorithm text;

comment on table media_fingerprints is
  'Perceptual fingerprints for owner protection and provenance review only. Never use for advertising, face recognition or behavioural profiling.';
