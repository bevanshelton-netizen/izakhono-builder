-- CONNECTA content-owner alerts, provenance and business verification.

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  kind text not null check (kind in (
    'content_shared',
    'content_duplicate_detected',
    'business_verification',
    'safety'
  )),
  actor_id uuid references accounts(id) on delete set null,
  target_type text,
  target_id uuid,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_account_created_idx
  on notifications(account_id, created_at desc);

create table if not exists content_shares (
  id uuid primary key default gen_random_uuid(),
  sharer_id uuid not null references accounts(id) on delete cascade,
  owner_id uuid not null references accounts(id) on delete cascade,
  source_type text not null check (source_type in ('post','media')),
  source_id uuid not null,
  commentary text not null default '',
  status text not null default 'active' check (status in ('active','revoked','removed')),
  created_at timestamptz not null default now(),
  check (sharer_id <> owner_id)
);

create index if not exists content_shares_owner_created_idx
  on content_shares(owner_id, created_at desc);

create index if not exists content_shares_source_idx
  on content_shares(source_type, source_id, created_at desc);

create table if not exists content_duplicate_alerts (
  id uuid primary key default gen_random_uuid(),
  original_media_id uuid not null references media_assets(id) on delete cascade,
  original_owner_id uuid not null references accounts(id) on delete cascade,
  suspected_media_id uuid not null references media_assets(id) on delete cascade,
  suspected_owner_id uuid not null references accounts(id) on delete cascade,
  match_type text not null check (match_type in ('sha256','perceptual_hash')),
  state text not null default 'open' check (state in ('open','reviewing','confirmed_authorized','confirmed_violation','cleared')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(original_media_id, suspected_media_id)
);

create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references accounts(id) on delete cascade,
  legal_name text not null,
  trading_name text not null,
  registration_number text,
  country_code char(2) not null,
  website text,
  business_email text,
  verification_state text not null default 'pending'
    check (verification_state in ('pending','reviewing','verified','rejected','suspended')),
  verification_level text not null default 'basic'
    check (verification_level in ('basic','registered_business','enhanced')),
  verified_at timestamptz,
  verified_by text,
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists businesses_country_registration_uidx
  on businesses(country_code, lower(registration_number))
  where registration_number is not null and verification_state <> 'rejected';

create index if not exists businesses_owner_idx
  on businesses(owner_id, created_at desc);

create table if not exists business_verification_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  actor_subject text not null,
  action text not null check (action in ('submitted','review_started','verified','rejected','suspended','restored')),
  note text not null default '',
  created_at timestamptz not null default now()
);

comment on table notifications is
  'First-party user alerts only. Never use notification data for behavioural advertising or profiling.';
comment on table content_shares is
  'Shares retain provenance to the original owner and source. CONNECTA does not silently duplicate ownership.';
comment on table businesses is
  'A verified badge may only be shown when verification_state=verified.';
