-- IZAKHONO IDENTITY isolated persistence boundary.
-- Apply only after reviewing the target database and migration plan.
-- No raw document images, selfies, biometric templates or provider secrets belong here.

create schema if not exists identity_private;
revoke all on schema identity_private from public;
revoke all on schema identity_private from anon;
revoke all on schema identity_private from authenticated;
grant usage on schema identity_private to service_role;

create table if not exists identity_private.tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_key text not null unique,
  display_name text not null,
  status text not null default 'pending'
    check (status in ('pending','active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identity_private.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references identity_private.tenants(id) on delete cascade,
  principal_id uuid not null,
  role text not null check (role in ('tenant_admin','identity_operator','identity_reviewer','identity_reader')),
  permissions text[] not null default '{}',
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now(),
  unique (tenant_id, principal_id)
);

create table if not exists identity_private.verification_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references identity_private.tenants(id),
  subject_ref text not null,
  purpose text not null check (purpose in (
    'customer_onboarding','business_onboarding','employment',
    'supplier_onboarding','account_recovery','regulated_service'
  )),
  required_checks text[] not null,
  completed_checks text[] not null default '{}',
  failed_checks text[] not null default '{}',
  request_fingerprint text not null,
  legal_basis text not null,
  notice_version text not null,
  authorisation_reference text not null,
  status text not null check (status in (
    'created','consent_pending','in_progress','verified','failed',
    'manual_review','provider_unavailable','expired','cancelled'
  )),
  provider_id text,
  provider_reference text,
  idempotency_key text not null,
  created_by uuid not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists verification_requests_tenant_created_idx
  on identity_private.verification_requests (tenant_id, created_at desc);
create index if not exists verification_requests_status_idx
  on identity_private.verification_requests (status, updated_at desc);

create table if not exists identity_private.evidence_metadata (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references identity_private.tenants(id),
  request_id uuid not null references identity_private.verification_requests(id) on delete cascade,
  evidence_kind text not null check (evidence_kind in (
    'identity_document','selfie','nfc_result','provider_receipt'
  )),
  encrypted_object_ref text not null,
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  captured_at timestamptz not null,
  retention_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists identity_private.provider_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references identity_private.tenants(id),
  request_id uuid not null references identity_private.verification_requests(id) on delete cascade,
  provider_id text not null,
  provider_reference text,
  attempt_status text not null check (attempt_status in (
    'started','completed','failed','provider_unavailable','timed_out'
  )),
  reason_codes text[] not null default '{}',
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists identity_private.consent_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references identity_private.tenants(id),
  request_id uuid not null references identity_private.verification_requests(id) on delete cascade,
  subject_ref text not null,
  purpose text not null,
  notice_version text not null,
  legal_basis text not null,
  consent_status text not null check (consent_status in ('granted','declined','withdrawn','not_required')),
  captured_at timestamptz not null default now(),
  evidence_ref text
);

create table if not exists identity_private.verification_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references identity_private.tenants(id),
  request_id uuid not null unique references identity_private.verification_requests(id) on delete cascade,
  provider_id text not null,
  normalized_status text not null check (normalized_status in (
    'verified','failed','manual_review','provider_unavailable'
  )),
  completed_checks text[] not null default '{}',
  failed_checks text[] not null default '{}',
  reason_codes text[] not null default '{}',
  evidence_digest text,
  completed_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists identity_private.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references identity_private.tenants(id),
  request_id uuid references identity_private.verification_requests(id) on delete set null,
  actor_id uuid not null,
  action text not null,
  outcome text not null,
  correlation_id text not null,
  metadata jsonb not null default '{}',
  occurred_at timestamptz not null default now()
);
create index if not exists identity_audit_tenant_time_idx
  on identity_private.audit_events (tenant_id, occurred_at desc);

-- Audit records are append-only even for privileged application credentials.
create or replace function identity_private.prevent_audit_mutation()
returns trigger
language plpgsql
as $
begin
  raise exception 'identity audit events are append-only';
end;
$;

drop trigger if exists identity_audit_no_update on identity_private.audit_events;
create trigger identity_audit_no_update
before update or delete on identity_private.audit_events
for each row execute function identity_private.prevent_audit_mutation();


do $$
declare t text;
begin
  foreach t in array array[
    'tenants','tenant_memberships','verification_requests','evidence_metadata',
    'provider_attempts','consent_records','verification_results','audit_events'
  ] loop
    execute format('alter table identity_private.%I enable row level security', t);
    execute format('revoke all on table identity_private.%I from public, anon, authenticated', t);
    execute format('grant select, insert, update, delete on table identity_private.%I to service_role', t);
  end loop;
end $$;

grant usage, select on all sequences in schema identity_private to service_role;

comment on schema identity_private is
  'IZAKHONO IDENTITY private persistence schema. No direct browser access. Service access must be mediated by authenticated server-side policy enforcement.';
