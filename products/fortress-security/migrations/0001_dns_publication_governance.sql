-- FORTRESS-owned durable governance records for DNS publication.
-- Approval rows are written only by the FORTRESS approval workflow.
CREATE TABLE IF NOT EXISTS fortress_dns_publication_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action = 'dns.publish'),
  resource TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  desired_serial BIGINT NOT NULL CHECK (desired_serial > 0),
  environment TEXT NOT NULL CHECK (environment = 'production'),
  decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'DENIED')),
  approver_id TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fortress_dns_approval_scope_idx
  ON fortress_dns_publication_approvals (tenant_id, resource, desired_serial, expires_at);

CREATE TABLE IF NOT EXISTS fortress_dns_publication_audit (
  id TEXT PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL,
  principal_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  action TEXT NOT NULL,
  resource TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ALLOWED', 'DENIED')),
  reason TEXT,
  evidence_digest TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION fortress_reject_dns_audit_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'FORTRESS DNS publication audit is append-only';
END;
$$;

DROP TRIGGER IF EXISTS fortress_dns_audit_no_update ON fortress_dns_publication_audit;
CREATE TRIGGER fortress_dns_audit_no_update
  BEFORE UPDATE OR DELETE ON fortress_dns_publication_audit
  FOR EACH ROW EXECUTE FUNCTION fortress_reject_dns_audit_mutation();
