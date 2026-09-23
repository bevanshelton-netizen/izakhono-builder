-- CONNECTA business verification evidence and badge gates.

create table if not exists business_verification_evidence (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  evidence_type text not null check (evidence_type in (
    'owner_identity',
    'registration_record',
    'business_bank_account',
    'business_address',
    'domain_control',
    'tax_record',
    'other'
  )),
  reference text not null,
  checksum_sha256 text,
  state text not null default 'pending' check (state in ('pending','accepted','rejected')),
  reviewer_subject text,
  review_note text not null default '',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists business_verification_evidence_business_idx
  on business_verification_evidence(business_id, state, evidence_type);

comment on table business_verification_evidence is
  'Verification references/evidence metadata. Private verification evidence must never be exposed by the public business endpoint.';
