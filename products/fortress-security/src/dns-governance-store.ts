import type { AuditEvent } from './audit-log.js';
import type { DnsApprovalResolver, DnsDeploymentApproval, FortressAuditWriter } from './dns-deployment-authorization.js';

export interface FortressSqlResult<Row = Record<string, unknown>> {
  rows: Row[];
  rowCount?: number | null;
}

export interface FortressSqlConnection {
  query<Row = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<FortressSqlResult<Row>>;
  end(): Promise<void>;
}

export type FortressConnectionFactory = () => Promise<FortressSqlConnection>;

const APPROVAL_SCHEMA = `
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
`;

const AUDIT_SCHEMA = `
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
`;

interface ApprovalRow {
  id: string;
  tenant_id: string;
  action: 'dns.publish';
  resource: string;
  zone_name: string;
  desired_serial: string | number;
  environment: 'production';
  decision: 'APPROVED' | 'DENIED';
  approver_id: string;
  expires_at: Date | string;
}

/**
 * PostgreSQL adapter for FORTRESS DNS governance.
 * It deliberately exposes approval reads and audit appends only. Approval
 * creation/revocation must be performed by the authenticated FORTRESS workflow.
 */
export class PostgresDnsGovernanceStore {
  constructor(private readonly connect: FortressConnectionFactory) {}

  async initialize(): Promise<void> {
    const db = await this.connect();
    try {
      await db.query('BEGIN');
      await db.query(APPROVAL_SCHEMA);
      await db.query(AUDIT_SCHEMA);
      await db.query('COMMIT');
    } catch (error) {
      try { await db.query('ROLLBACK'); } catch {}
      throw error;
    } finally {
      await db.end();
    }
  }

  readonly resolveApproval: DnsApprovalResolver = async (approvalId) => {
    const db = await this.connect();
    try {
      const result = await db.query<ApprovalRow>(
        `SELECT id, tenant_id, action, resource, zone_name, desired_serial,
                environment, decision, approver_id, expires_at
           FROM fortress_dns_publication_approvals
          WHERE id = $1 AND revoked_at IS NULL
          LIMIT 1`,
        [approvalId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        id: row.id,
        tenantId: row.tenant_id,
        action: row.action,
        resource: row.resource,
        zoneName: row.zone_name,
        desiredSerial: Number(row.desired_serial),
        environment: row.environment,
        decision: row.decision,
        approverId: row.approver_id,
        expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : new Date(row.expires_at).toISOString(),
      } satisfies DnsDeploymentApproval;
    } finally {
      await db.end();
    }
  };

  readonly appendAudit: FortressAuditWriter = async (event: AuditEvent) => {
    const db = await this.connect();
    try {
      await db.query(
        `INSERT INTO fortress_dns_publication_audit
          (id, occurred_at, principal_id, tenant_id, action, resource, outcome, reason, evidence_digest)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [event.id, event.occurredAt, event.principalId, event.tenantId, event.action,
         event.resource, event.outcome, event.reason ?? null, event.evidenceDigest ?? null],
      );
    } finally {
      await db.end();
    }
  };
}
