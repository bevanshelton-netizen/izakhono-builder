-- CONNECTA Discovery Engine: verified Benefits, Commerce and Vehicles.
-- Migration is intentionally additive and does not publish unverified records.

create table if not exists connecta_discovery_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('benefit','commerce','vehicle')),
  title text not null,
  category text not null,
  description text not null default '',
  provider_name text,
  provider_id uuid,
  trust_status text not null default 'SUBMITTED'
    check (trust_status in ('SUBMITTED','VERIFICATION_PENDING','VERIFIED','ACTIVE','SUSPENDED','REJECTED')),
  source_reference text,
  agreement_reference text,
  terms_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  price_display text,
  currency text,
  location_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  verified_at timestamptz
);

create index if not exists connecta_discovery_active_idx
  on connecta_discovery_records(kind, category, trust_status, updated_at desc);

create index if not exists connecta_discovery_provider_idx
  on connecta_discovery_records(provider_id, trust_status);

create table if not exists connecta_discovery_verifications (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references connecta_discovery_records(id) on delete cascade,
  evidence_type text not null,
  evidence_reference text not null,
  decision text not null check (decision in ('PENDING','VERIFIED','REJECTED','REVOKED')),
  reviewer_subject text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create index if not exists connecta_discovery_verification_record_idx
  on connecta_discovery_verifications(record_id, decision, created_at desc);

create table if not exists connecta_discovery_enquiries (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references connecta_discovery_records(id) on delete restrict,
  requester_id uuid,
  consent_to_contact boolean not null default false,
  message text not null default '',
  attribution_id text not null unique,
  state text not null default 'SUBMITTED'
    check (state in ('SUBMITTED','ROUTED','ACKNOWLEDGED','OUTCOME_PENDING','EVIDENCED','DISPUTED','CLOSED')),
  created_at timestamptz not null default now(),
  routed_at timestamptz,
  outcome_at timestamptz
);

create index if not exists connecta_discovery_enquiry_record_idx
  on connecta_discovery_enquiries(record_id, created_at desc);

create table if not exists connecta_discovery_attribution (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references connecta_discovery_enquiries(id) on delete cascade,
  campaign_id text,
  partner_id uuid,
  conversion_state text not null default 'UNKNOWN'
    check (conversion_state in ('UNKNOWN','PENDING','EVIDENCED','REVERSED')),
  evidence_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists connecta_discovery_attribution_campaign_idx
  on connecta_discovery_attribution(campaign_id, conversion_state);

-- Only verified/active records may be returned by public discovery queries.
create or replace view connecta_public_discovery as
select *
from connecta_discovery_records
where trust_status = 'ACTIVE';
