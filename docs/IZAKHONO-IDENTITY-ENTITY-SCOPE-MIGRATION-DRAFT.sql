-- REVIEW DRAFT ONLY — NOT AN APPLIED SUPABASE MIGRATION.
-- Generate the final migration with the Supabase CLI after repository/schema reconciliation.
-- This migration deliberately does not infer entity ownership for existing records.
-- Existing legacy cases without canonical scope remain inaccessible through the new API
-- until individually reconciled through an owner-approved process.

begin;

alter table identity.subjects
  add column if not exists canonical_user_id text,
  add column if not exists canonical_entity_id text;

create unique index if not exists identity_subject_canonical_user_uq
  on identity.subjects(canonical_user_id)
  where subject_type = 'individual' and canonical_user_id is not null;

create unique index if not exists identity_subject_canonical_entity_uq
  on identity.subjects(canonical_entity_id)
  where subject_type = 'business' and canonical_entity_id is not null;

alter table identity.verification_cases
  add column if not exists entity_id text,
  add column if not exists membership_id text,
  add column if not exists opened_by_user_id text,
  add column if not exists canonical_session_id text;

alter table identity.verification_cases
  add constraint identity_case_canonical_scope_required
  check (
    entity_id ~ '^ent_[0-9a-f]{32}$'
    and membership_id ~ '^mem_[0-9a-f]{32}$'
    and opened_by_user_id ~ '^usr_[0-9a-f]{32}$'
    and length(canonical_session_id) between 1 and 160
  ) not valid;

create index if not exists identity_cases_entity_membership_created_idx
  on identity.verification_cases(entity_id, membership_id, created_at desc);

create index if not exists identity_cases_entity_owner_created_idx
  on identity.verification_cases(entity_id, opened_by_user_id, created_at desc);

alter table identity.evidence
  add column if not exists submitted_by_user_id text;

alter table identity.subject_relationships
  add column if not exists verification_case_id uuid
    references identity.verification_cases(id) on delete restrict;

alter table identity.subject_relationships
  add constraint identity_relationship_case_required
  check (verification_case_id is not null) not valid;

create index if not exists identity_relationship_case_idx
  on identity.subject_relationships(verification_case_id, relationship_type);

alter table identity.consent_grants
  add column if not exists verification_case_id uuid
    references identity.verification_cases(id) on delete restrict,
  add column if not exists granted_by_user_id text;

alter table identity.consent_grants
  alter column granted_by drop not null;

alter table identity.consent_grants
  add constraint identity_consent_canonical_actor_case_required
  check (
    verification_case_id is not null
    and granted_by_user_id ~ '^usr_[0-9a-f]{32}$'
  ) not valid;

create index if not exists identity_consent_case_status_idx
  on identity.consent_grants(verification_case_id, status, granted_at desc);

alter table identity.decisions
  add column if not exists decided_by_user_id text;

alter table identity.audit_events
  add column if not exists entity_id text,
  add column if not exists membership_id text;

-- Keep the identity schema private. Existing service_role-only grants and policies
-- remain the only intended database access path. Do not grant browser roles.
commit;
