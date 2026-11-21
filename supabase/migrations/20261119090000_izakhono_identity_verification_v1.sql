-- IZAKHONO IDENTITY & BUSINESS VERIFICATION PLATFORM
-- Additive, service-only persistence boundary. Does not alter FORTRESS ledger,
-- existing merchant activation gates, or existing KYC/KYB decisions.
begin;

create schema if not exists identity;
revoke all on schema identity from public, anon, authenticated;
grant usage on schema identity to service_role;

create table if not exists identity.subjects (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('individual','business')),
  auth_user_id uuid null references auth.users(id) on delete restrict,
  country_code char(2) not null,
  external_subject_ref_hash char(64) null,
  source_system text not null default 'izakhono',
  source_record_type text null,
  source_record_id uuid null,
  lifecycle_status text not null default 'active'
    check (lifecycle_status in ('active','restricted','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_subject_country_code_chk check (country_code ~ '^[A-Z]{2}$'),
  constraint identity_subject_external_hash_chk
    check (external_subject_ref_hash is null or external_subject_ref_hash ~ '^[0-9a-f]{64}$')
);

create unique index if not exists identity_subject_user_type_uq
  on identity.subjects(auth_user_id, subject_type)
  where auth_user_id is not null and subject_type = 'individual';
create index if not exists identity_subject_source_idx
  on identity.subjects(source_system, source_record_type, source_record_id);

create table if not exists identity.verification_cases (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references identity.subjects(id) on delete restrict,
  verification_type text not null check (verification_type in ('KYC','KYB')),
  product_code text not null,
  country_code char(2) not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','in_review','approved','rejected','expired','withdrawn')),
  risk_level text not null default 'unknown'
    check (risk_level in ('unknown','low','medium','high','prohibited')),
  opened_by uuid null references auth.users(id) on delete set null,
  submitted_at timestamptz null,
  expires_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_case_country_code_chk check (country_code ~ '^[A-Z]{2}$')
);
create index if not exists identity_cases_subject_created_idx
  on identity.verification_cases(subject_id, created_at desc);
create index if not exists identity_cases_status_created_idx
  on identity.verification_cases(status, created_at desc);
create index if not exists identity_cases_product_idx
  on identity.verification_cases(product_code, verification_type, status);

create table if not exists identity.evidence (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references identity.verification_cases(id) on delete restrict,
  evidence_type text not null,
  storage_bucket text not null,
  storage_object_path text not null,
  content_sha256 char(64) not null,
  issuer_code text null,
  issued_at date null,
  expires_on date null,
  status text not null default 'submitted'
    check (status in ('submitted','validated','rejected','expired','superseded')),
  validation_provider text null,
  validation_reference text null,
  metadata jsonb not null default '{}'::jsonb,
  submitted_by uuid null references auth.users(id) on delete set null,
  validated_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint identity_evidence_hash_chk check (content_sha256 ~ '^[0-9a-f]{64}$'),
  constraint identity_evidence_object_path_chk check (length(storage_object_path) between 1 and 1024)
);
create index if not exists identity_evidence_case_status_idx
  on identity.evidence(case_id, status);
create unique index if not exists identity_evidence_object_hash_uq
  on identity.evidence(storage_bucket, storage_object_path, content_sha256);

create table if not exists identity.subject_relationships (
  id uuid primary key default gen_random_uuid(),
  entity_subject_id uuid not null references identity.subjects(id) on delete restrict,
  person_subject_id uuid not null references identity.subjects(id) on delete restrict,
  relationship_type text not null
    check (relationship_type in ('director','beneficial_owner','shareholder','trustee','partner','authorised_representative','controller')),
  ownership_percentage numeric(5,2) null
    check (ownership_percentage is null or ownership_percentage between 0 and 100),
  control_basis text null,
  verification_status text not null default 'unverified'
    check (verification_status in ('unverified','pending','verified','rejected','expired')),
  valid_from date not null default current_date,
  valid_until date null,
  source_evidence_id uuid null references identity.evidence(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint identity_relationship_distinct_subjects_chk check (entity_subject_id <> person_subject_id),
  constraint identity_relationship_dates_chk check (valid_until is null or valid_until >= valid_from)
);
create index if not exists identity_relationship_entity_idx
  on identity.subject_relationships(entity_subject_id, relationship_type, verification_status);
create index if not exists identity_relationship_person_idx
  on identity.subject_relationships(person_subject_id, verification_status);

create table if not exists identity.screenings (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references identity.verification_cases(id) on delete restrict,
  screening_type text not null
    check (screening_type in ('sanctions','pep','adverse_media','fraud','identity_document','company_registry')),
  provider_code text not null,
  provider_reference text null,
  outcome text not null default 'pending'
    check (outcome in ('pending','clear','potential_match','confirmed_match','unavailable','error')),
  result_sha256 char(64) null,
  checked_at timestamptz null,
  expires_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint identity_screening_hash_chk
    check (result_sha256 is null or result_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists identity_screenings_case_type_idx
  on identity.screenings(case_id, screening_type, created_at desc);

create table if not exists identity.consent_grants (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references identity.subjects(id) on delete restrict,
  granted_by uuid not null references auth.users(id) on delete restrict,
  purpose_code text not null,
  recipient_product text not null,
  scopes text[] not null,
  legal_basis text not null,
  notice_version text not null,
  status text not null default 'granted'
    check (status in ('granted','revoked','expired')),
  granted_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  consent_record_sha256 char(64) not null,
  constraint identity_consent_scopes_nonempty_chk check (cardinality(scopes) > 0),
  constraint identity_consent_hash_chk check (consent_record_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists identity_consent_subject_status_idx
  on identity.consent_grants(subject_id, status, granted_at desc);

create table if not exists identity.decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references identity.verification_cases(id) on delete restrict,
  decision text not null check (decision in ('APPROVE','REVIEW','REJECT')),
  risk_score numeric(5,2) not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('low','medium','high','prohibited')),
  reason_codes text[] not null,
  policy_version text not null,
  evidence_snapshot_sha256 char(64) not null,
  decided_by uuid null references auth.users(id) on delete set null,
  decision_origin text not null check (decision_origin in ('rules_engine','provider','human')),
  created_at timestamptz not null default now(),
  constraint identity_decision_hash_chk check (evidence_snapshot_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists identity_decisions_case_created_idx
  on identity.decisions(case_id, created_at desc);

create table if not exists identity.audit_events (
  id bigint generated always as identity primary key,
  event_id uuid not null default gen_random_uuid() unique,
  event_type text not null,
  actor_type text not null check (actor_type in ('user','service','provider','system')),
  actor_ref_hash char(64) null,
  subject_id uuid null references identity.subjects(id) on delete restrict,
  case_id uuid null references identity.verification_cases(id) on delete restrict,
  correlation_id uuid null,
  payload_sha256 char(64) not null,
  occurred_at timestamptz not null default now(),
  constraint identity_audit_actor_hash_chk
    check (actor_ref_hash is null or actor_ref_hash ~ '^[0-9a-f]{64}$'),
  constraint identity_audit_payload_hash_chk check (payload_sha256 ~ '^[0-9a-f]{64}$')
);
create index if not exists identity_audit_subject_time_idx
  on identity.audit_events(subject_id, occurred_at desc);
create index if not exists identity_audit_case_time_idx
  on identity.audit_events(case_id, occurred_at desc);
create index if not exists identity_audit_correlation_idx
  on identity.audit_events(correlation_id)
  where correlation_id is not null;

create or replace function identity.prevent_immutable_record_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'identity.% is append-only; create a superseding record instead', TG_TABLE_NAME
    using errcode = '55000';
end;
$$;

drop trigger if exists identity_decisions_immutable on identity.decisions;
create trigger identity_decisions_immutable
  before update or delete on identity.decisions
  for each row execute function identity.prevent_immutable_record_mutation();

drop trigger if exists identity_audit_events_immutable on identity.audit_events;
create trigger identity_audit_events_immutable
  before update or delete on identity.audit_events
  for each row execute function identity.prevent_immutable_record_mutation();

alter table identity.subjects enable row level security;
alter table identity.verification_cases enable row level security;
alter table identity.evidence enable row level security;
alter table identity.subject_relationships enable row level security;
alter table identity.screenings enable row level security;
alter table identity.consent_grants enable row level security;
alter table identity.decisions enable row level security;
alter table identity.audit_events enable row level security;

alter table identity.subjects force row level security;
alter table identity.verification_cases force row level security;
alter table identity.evidence force row level security;
alter table identity.subject_relationships force row level security;
alter table identity.screenings force row level security;
alter table identity.consent_grants force row level security;
alter table identity.decisions force row level security;
alter table identity.audit_events force row level security;

revoke all on all tables in schema identity from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema identity to service_role;
grant usage, select on all sequences in schema identity to service_role;
revoke execute on function identity.prevent_immutable_record_mutation() from public, anon, authenticated;

comment on schema identity is
  'IZAKHONO shared KYC/KYB service data boundary. Not exposed to browser roles; accessed only through authenticated server-side services.';
comment on table identity.evidence is
  'Stores private object references and cryptographic hashes only; never store raw identity documents or biometric templates in row metadata.';
comment on table identity.decisions is
  'Append-only verification decisions with policy version and evidence snapshot hash.';
comment on table identity.audit_events is
  'Append-only, privacy-minimised audit events; payload content is represented by a cryptographic hash.';

commit;
