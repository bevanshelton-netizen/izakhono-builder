-- WORKNOW Connector Mode: employer, vacancy and direct-application persistence.
-- No candidate CV/profile content is stored in this first migration.
-- D1/SQLite does not provide row-level security: every query MUST enforce
-- authenticated user + employer membership + tenant scope in the server adapter.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS worknow_employers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  legal_name TEXT NOT NULL,
  registration_number TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK(country_code = 'ZA'),
  verification_status TEXT NOT NULL DEFAULT 'pending'
    CHECK(verification_status IN ('pending','verified','rejected','suspended')),
  verified_by TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, id),
  UNIQUE(country_code, registration_number)
);
CREATE INDEX IF NOT EXISTS idx_worknow_employers_tenant_status
  ON worknow_employers(tenant_id, verification_status, created_at DESC);

CREATE TABLE IF NOT EXISTS worknow_employer_memberships (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  employer_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','recruiter','viewer')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, employer_id, user_id),
  FOREIGN KEY(tenant_id, employer_id) REFERENCES worknow_employers(tenant_id, id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_worknow_memberships_user
  ON worknow_employer_memberships(user_id, tenant_id, employer_id);

CREATE TABLE IF NOT EXISTS worknow_vacancies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  employer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  country_code TEXT NOT NULL CHECK(country_code = 'ZA'),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','pending_review','published','paused','closed','rejected')),
  submitted_at TEXT,
  published_at TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_note TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, id),
  FOREIGN KEY(tenant_id, employer_id) REFERENCES worknow_employers(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_worknow_vacancies_public
  ON worknow_vacancies(country_code, status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_worknow_vacancies_employer
  ON worknow_vacancies(tenant_id, employer_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS worknow_applications (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  vacancy_id TEXT NOT NULL,
  employer_id TEXT NOT NULL,
  applicant_subject_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK(status IN ('submitted','employer_received','withdrawn')),
  direct_employer_consent INTEGER NOT NULL CHECK(direct_employer_consent = 1),
  privacy_notice_version TEXT NOT NULL,
  consented_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  employer_received_at TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, id),
  UNIQUE(tenant_id, vacancy_id, applicant_subject_id),
  FOREIGN KEY(tenant_id, vacancy_id) REFERENCES worknow_vacancies(tenant_id, id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id, employer_id) REFERENCES worknow_employers(tenant_id, id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_worknow_applications_employer
  ON worknow_applications(tenant_id, employer_id, status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_worknow_applications_applicant
  ON worknow_applications(applicant_subject_id, status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS worknow_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor_subject_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('success','denied','failed')),
  event_time TEXT NOT NULL,
  request_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_worknow_audit_tenant_time
  ON worknow_audit_events(tenant_id, event_time DESC);
CREATE INDEX IF NOT EXISTS idx_worknow_audit_resource
  ON worknow_audit_events(resource_type, resource_id, event_time DESC);

CREATE TRIGGER IF NOT EXISTS worknow_audit_events_no_update
BEFORE UPDATE ON worknow_audit_events
BEGIN
  SELECT RAISE(ABORT, 'WORKNOW audit events are append-only');
END;

-- Connector Mode commercial prohibitions are represented as immutable policy data
-- in application code; no fee/placement tables or billing endpoints are created.
