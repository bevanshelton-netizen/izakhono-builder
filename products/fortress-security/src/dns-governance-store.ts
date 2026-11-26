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
