-- Explicit organisation tenancy for Mobile Intelligence.
-- Never derive organisation IDs or access from builder_customers.organization display text.
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS builder_organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK(status IN ('active','suspended','closed')),
  created_by_customer_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(created_by_customer_id) REFERENCES builder_customers(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_builder_organisations_status
  ON builder_organisations(status, created_at DESC);

CREATE TABLE IF NOT EXISTS builder_organisation_memberships (
  id TEXT PRIMARY KEY,
  organisation_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','member')),
  status TEXT NOT NULL DEFAULT 'invited'
    CHECK(status IN ('invited','active','revoked')),
  invited_by_customer_id TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(organisation_id) REFERENCES builder_organisations(id) ON DELETE CASCADE,
  FOREIGN KEY(customer_id) REFERENCES builder_customers(id) ON DELETE CASCADE,
  FOREIGN KEY(invited_by_customer_id) REFERENCES builder_customers(id) ON DELETE SET NULL,
  UNIQUE(organisation_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_builder_org_memberships_customer
  ON builder_organisation_memberships(customer_id, status, organisation_id);
CREATE INDEX IF NOT EXISTS idx_builder_org_memberships_org
  ON builder_organisation_memberships(organisation_id, status, role);

-- At most one active owner per organisation. Ownership transfer must be explicit.
CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_org_one_active_owner
  ON builder_organisation_memberships(organisation_id)
  WHERE role='owner' AND status='active';
