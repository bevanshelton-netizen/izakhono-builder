-- REVIEW DRAFT ONLY. NOT AN APPLIED SUPABASE MIGRATION.
-- Generate the final migration with the Supabase CLI after reconciling live history.
-- Never infer canonical tenant ownership for legacy records.
-- The live audit on 2026-11-20 found all eight identity tables empty.
-- This preflight aborts if any identity rows exist when the migration is run.

BEGIN;

DO LANGUAGE plpgsql
'BEGIN
  IF EXISTS (SELECT 1 FROM identity.subjects)
     OR EXISTS (SELECT 1 FROM identity.verification_cases)
     OR EXISTS (SELECT 1 FROM identity.evidence)
     OR EXISTS (SELECT 1 FROM identity.subject_relationships)
     OR EXISTS (SELECT 1 FROM identity.screenings)
     OR EXISTS (SELECT 1 FROM identity.consent_grants)
     OR EXISTS (SELECT 1 FROM identity.decisions)
     OR EXISTS (SELECT 1 FROM identity.audit_events) THEN
    RAISE EXCEPTION ''Identity records exist; reconcile canonical entity and membership ownership before applying this draft.'';
  END IF;
END';

ALTER TABLE identity.subjects
  ADD COLUMN IF NOT EXISTS canonical_user_id text,
  ADD COLUMN IF NOT EXISTS canonical_entity_id text;

CREATE UNIQUE INDEX IF NOT EXISTS identity_subject_canonical_user_uq
  ON identity.subjects(canonical_user_id)
  WHERE subject_type = 'individual' AND canonical_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS identity_subject_canonical_entity_uq
  ON identity.subjects(canonical_entity_id)
  WHERE subject_type = 'business' AND canonical_entity_id IS NOT NULL;

ALTER TABLE identity.verification_cases
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS membership_id text,
  ADD COLUMN IF NOT EXISTS opened_by_user_id text,
  ADD COLUMN IF NOT EXISTS canonical_session_id text;

ALTER TABLE identity.verification_cases
  ADD CONSTRAINT identity_case_canonical_scope_required
  CHECK (
    entity_id IS NOT NULL
    AND length(entity_id) = 36
    AND left(entity_id, 4) = 'ent_'
    AND substring(entity_id FROM 5) ~ '^[0-9a-f]{32}'
    AND membership_id IS NOT NULL
    AND length(membership_id) = 36
    AND left(membership_id, 4) = 'mem_'
    AND substring(membership_id FROM 5) ~ '^[0-9a-f]{32}'
    AND opened_by_user_id IS NOT NULL
    AND length(opened_by_user_id) = 36
    AND left(opened_by_user_id, 4) = 'usr_'
    AND substring(opened_by_user_id FROM 5) ~ '^[0-9a-f]{32}'
    AND canonical_session_id IS NOT NULL
    AND length(canonical_session_id) BETWEEN 1 AND 160
  ) NOT VALID;

ALTER TABLE identity.verification_cases
  VALIDATE CONSTRAINT identity_case_canonical_scope_required;

CREATE INDEX IF NOT EXISTS identity_cases_entity_membership_created_idx
  ON identity.verification_cases(entity_id, membership_id, created_at DESC);

CREATE INDEX IF NOT EXISTS identity_cases_entity_owner_created_idx
  ON identity.verification_cases(entity_id, opened_by_user_id, created_at DESC);

ALTER TABLE identity.evidence
  ADD COLUMN IF NOT EXISTS submitted_by_user_id text,
  ADD COLUMN IF NOT EXISTS malware_scan_status text,
  ADD COLUMN IF NOT EXISTS malware_scan_engine text,
  ADD COLUMN IF NOT EXISTS malware_signature_version text,
  ADD COLUMN IF NOT EXISTS malware_scanned_at timestamptz,
  ADD COLUMN IF NOT EXISTS malware_scan_sha256 text;

ALTER TABLE identity.evidence
  ADD CONSTRAINT identity_evidence_canonical_submitter_required
  CHECK (
    submitted_by_user_id IS NOT NULL
    AND length(submitted_by_user_id) = 36
    AND left(submitted_by_user_id, 4) = 'usr_'
    AND substring(submitted_by_user_id FROM 5) ~ '^[0-9a-f]{32}'
  ) NOT VALID;

ALTER TABLE identity.evidence
  VALIDATE CONSTRAINT identity_evidence_canonical_submitter_required;

ALTER TABLE identity.evidence
  ADD CONSTRAINT identity_evidence_clean_malware_scan_required
  CHECK (
    malware_scan_status = 'clean'
    AND malware_scan_engine IS NOT NULL
    AND length(malware_scan_engine) BETWEEN 1 AND 80
    AND malware_signature_version IS NOT NULL
    AND length(malware_signature_version) BETWEEN 1 AND 100
    AND malware_scanned_at IS NOT NULL
    AND malware_scan_sha256 IS NOT NULL
    AND length(malware_scan_sha256) = 64
    AND substring(malware_scan_sha256 FROM 1) ~ '^[0-9a-f]{64}'
    AND malware_scan_sha256 = content_sha256
  ) NOT VALID;

ALTER TABLE identity.evidence
  VALIDATE CONSTRAINT identity_evidence_clean_malware_scan_required;

ALTER TABLE identity.subject_relationships
  ADD COLUMN IF NOT EXISTS verification_case_id uuid
    REFERENCES identity.verification_cases(id) ON DELETE RESTRICT;

ALTER TABLE identity.subject_relationships
  ADD CONSTRAINT identity_relationship_case_required
  CHECK (verification_case_id IS NOT NULL) NOT VALID;

ALTER TABLE identity.subject_relationships
  VALIDATE CONSTRAINT identity_relationship_case_required;

CREATE INDEX IF NOT EXISTS identity_relationship_case_idx
  ON identity.subject_relationships(verification_case_id, relationship_type);

ALTER TABLE identity.consent_grants
  ADD COLUMN IF NOT EXISTS verification_case_id uuid
    REFERENCES identity.verification_cases(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS granted_by_user_id text;

ALTER TABLE identity.consent_grants
  ALTER COLUMN granted_by DROP NOT NULL;

ALTER TABLE identity.consent_grants
  ADD CONSTRAINT identity_consent_canonical_actor_case_required
  CHECK (
    verification_case_id IS NOT NULL
    AND granted_by_user_id IS NOT NULL
    AND length(granted_by_user_id) = 36
    AND left(granted_by_user_id, 4) = 'usr_'
    AND substring(granted_by_user_id FROM 5) ~ '^[0-9a-f]{32}'
  ) NOT VALID;

ALTER TABLE identity.consent_grants
  VALIDATE CONSTRAINT identity_consent_canonical_actor_case_required;

CREATE INDEX IF NOT EXISTS identity_consent_case_status_idx
  ON identity.consent_grants(verification_case_id, status, granted_at DESC);

ALTER TABLE identity.decisions
  ADD COLUMN IF NOT EXISTS decided_by_user_id text;

ALTER TABLE identity.audit_events
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS membership_id text;

-- Keep the identity schema private. Do not grant browser roles.
-- Preserve the existing forced RLS and service-role-only database access model.

COMMIT;
