-- CONNECTA discovery / benefits / commerce / vehicle trust layer.
-- Public discovery is ACTIVE-only; verification evidence is required before publication.
-- No discovery record implies a sale, donation settlement, or partner relationship.

create table if not exists connecta_discovery_records (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('benefit','commerce','vehicle')),
  title text not null,
  category text not null,
  description text not null default '',
  provider_name text,
  provider_id uuid,
  trust_status text not null default 'SUBMITTED' check (trust_status in ('SUBMITTED','VERIFICATION_PENDING','ACTIVE','REJECTED','SUSPENDED')),
  source_reference text,
  agreement_reference text,
  terms_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  price_display text,
  currency char(3),
  location_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references accounts(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists connecta_discovery_records_public_idx
  on connecta_discovery_records(trust_status, kind, category, updated_at desc);
create index if not exists connecta_discovery_records_provider_idx
  on connecta_discovery_records(provider_id, trust_status, updated_at desc);

create table if not exists connecta_discovery_verifications (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references connecta_discovery_records(id) on delete cascade,
  evidence_type text not null,
  evidence_reference text not null,
  decision text not null default 'PENDING' check (decision in ('PENDING','VERIFIED','REJECTED','REVOKED')),
  reviewer_subject text,
  notes text not null default '',
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists connecta_discovery_verifications_record_idx
  on connecta_discovery_verifications(record_id, decision, created_at desc);

create table if not exists connecta_discovery_enquiries (
  id uuid primary key default gen_random_uuid(),
  record_id uuid not null references connecta_discovery_records(id) on delete restrict,
  requester_id uuid not null references accounts(id) on delete restrict,
  consent_to_contact boolean not null default false,
  message text not null default '',
  attribution_id text not null unique,
  created_at timestamptz not null default now()
);

create index if not exists connecta_discovery_enquiries_record_idx
  on connecta_discovery_enquiries(record_id, created_at desc);
create index if not exists connecta_discovery_enquiries_requester_idx
  on connecta_discovery_enquiries(requester_id, created_at desc);

create table if not exists connecta_discovery_attribution (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references connecta_discovery_enquiries(id) on delete cascade,
  campaign_id text,
  partner_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists connecta_discovery_attribution_enquiry_idx
  on connecta_discovery_attribution(enquiry_id);
create index if not exists connecta_discovery_attribution_partner_idx
  on connecta_discovery_attribution(partner_id, created_at desc);

create or replace view connecta_public_discovery as
select
  id, kind, title, category, description, provider_name, terms_url,
  starts_at, ends_at, price_display, currency, location_text, metadata,
  verified_at, updated_at
from connecta_discovery_records
where trust_status = 'ACTIVE';

comment on table connecta_discovery_records is
  'Trust-gated public discovery records for benefits, commerce and vehicles. Only ACTIVE records are public.';
comment on table connecta_discovery_verifications is
  'Evidence and reviewer decisions required before a discovery record becomes ACTIVE.';
comment on table connecta_discovery_enquiries is
  'Authenticated user enquiries. An enquiry is not a sale or conversion.';
comment on view connecta_public_discovery is
  'Public discovery projection containing ACTIVE records only.';
