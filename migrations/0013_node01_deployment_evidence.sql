-- NODE01 deployment evidence ledger.
-- Evidence is immutable by deployment id and tied to the exact release candidate revision/head.
CREATE TABLE IF NOT EXISTS builder_deployment_evidence (
  deployment_id TEXT PRIMARY KEY,
  app_id TEXT NOT NULL,
  developer_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  internal_repository_head TEXT NOT NULL,
  runtime_url TEXT NOT NULL,
  http_status INTEGER NOT NULL,
  tls_verified INTEGER NOT NULL CHECK (tls_verified IN (0,1)),
  dns_verified INTEGER NOT NULL CHECK (dns_verified IN (0,1)),
  rollback_verified INTEGER NOT NULL CHECK (rollback_verified IN (0,1)),
  evidence_hash TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('accepted','rejected')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_builder_deployment_evidence_hash
  ON builder_deployment_evidence(evidence_hash);
CREATE INDEX IF NOT EXISTS idx_builder_deployment_evidence_app
  ON builder_deployment_evidence(app_id, created_at DESC);
