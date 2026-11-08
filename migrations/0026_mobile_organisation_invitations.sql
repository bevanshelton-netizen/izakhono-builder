-- One-time, email-bound organisation invitations. Raw invite tokens are never persisted.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS builder_organisation_invitations (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('admin','member')),
  token_hash TEXT NOT NULL UNIQUE,
  invited_by_customer_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organisation_id) REFERENCES builder_organisations(id) ON DELETE CASCADE,
  FOREIGN KEY(invited_by_customer_id) REFERENCES builder_customers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_builder_org_invites_pending
  ON builder_organisation_invitations(organisation_id, email, expires_at)
  WHERE accepted_at IS NULL AND revoked_at IS NULL;
