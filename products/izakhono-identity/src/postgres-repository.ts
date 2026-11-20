import type { AuditEvent, VerificationRepository, VerificationRequest } from "./types.js";

export interface SqlResult<Row> {
  rows: Row[];
  rowCount?: number;
}

/** Server-side parameterised SQL adapter for the IZAKHONO-owned PostgreSQL runtime. */
export interface SqlExecutor {
  query<Row = Record<string, unknown>>(sql: string, parameters?: unknown[]): Promise<SqlResult<Row>>;
}

interface RequestRow {
  id: string; tenant_id: string; subject_ref: string;
  purpose: VerificationRequest["purpose"];
  required_checks: VerificationRequest["requiredChecks"];
  completed_checks: VerificationRequest["completedChecks"];
  failed_checks: VerificationRequest["failedChecks"];
  request_fingerprint: string; status: VerificationRequest["status"];
  legal_basis: string; notice_version: string; authorisation_reference: string;
  provider_id: string | null; provider_reference: string | null;
  idempotency_key: string; created_by: string; created_at: string;
  updated_at: string; expires_at: string;
}

function mapRequest(row: RequestRow): VerificationRequest {
  return {
    id: row.id, tenantId: row.tenant_id, subjectRef: row.subject_ref,
    purpose: row.purpose, requiredChecks: row.required_checks,
    completedChecks: row.completed_checks, failedChecks: row.failed_checks,
    requestFingerprint: row.request_fingerprint, status: row.status,
    legalBasis: row.legal_basis, noticeVersion: row.notice_version,
    authorisationReference: row.authorisation_reference,
    ...(row.provider_id ? { providerId: row.provider_id } : {}),
    ...(row.provider_reference ? { providerReference: row.provider_reference } : {}),
    idempotencyKey: row.idempotency_key, createdBy: row.created_by,
    createdAt: row.created_at, updatedAt: row.updated_at, expiresAt: row.expires_at,
  };
}

const requestColumns = "id, tenant_id, subject_ref, purpose, required_checks, completed_checks, failed_checks, request_fingerprint, status, legal_basis, notice_version, authorisation_reference, provider_id, provider_reference, idempotency_key, created_by, created_at, updated_at, expires_at";

export class PostgresVerificationRepository implements VerificationRepository {
  constructor(private readonly sql: SqlExecutor) {}

  async findByIdempotencyKey(tenantId: string, key: string): Promise<VerificationRequest | null> {
    const result = await this.sql.query<RequestRow>(
      "select " + requestColumns + " from identity_private.verification_requests where tenant_id = $1 and idempotency_key = $2 limit 1",
      [tenantId, key],
    );
    return result.rows[0] ? mapRequest(result.rows[0]) : null;
  }

  async createRequest(request: VerificationRequest): Promise<void> {
    await this.sql.query(
      "insert into identity_private.verification_requests (id, tenant_id, subject_ref, purpose, required_checks, completed_checks, failed_checks, request_fingerprint, status, legal_basis, notice_version, authorisation_reference, provider_id, provider_reference, idempotency_key, created_by, created_at, updated_at, expires_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)",
      [
        request.id, request.tenantId, request.subjectRef, request.purpose,
        request.requiredChecks, request.completedChecks, request.failedChecks,
        request.requestFingerprint, request.status, request.legalBasis,
        request.noticeVersion, request.authorisationReference,
        request.providerId ?? null, request.providerReference ?? null,
        request.idempotencyKey, request.createdBy, request.createdAt,
        request.updatedAt, request.expiresAt,
      ],
    );
  }

  async updateRequest(request: VerificationRequest): Promise<void> {
    const result = await this.sql.query(
      "update identity_private.verification_requests set required_checks = $3, completed_checks = $4, failed_checks = $5, status = $6, provider_id = $7, provider_reference = $8, updated_at = $9 where id = $1 and tenant_id = $2",
      [
        request.id, request.tenantId, request.requiredChecks,
        request.completedChecks, request.failedChecks, request.status,
        request.providerId ?? null, request.providerReference ?? null,
        request.updatedAt,
      ],
    );
    if (result.rowCount === 0) throw new Error("Verification request not found");
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.sql.query(
      "insert into identity_private.audit_events (id, tenant_id, request_id, actor_id, action, outcome, correlation_id, metadata, occurred_at) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)",
      [
        event.id, event.tenantId, event.requestId ?? null, event.actorId,
        event.action, event.outcome, event.correlationId,
        JSON.stringify(event.metadata), event.occurredAt,
      ],
    );
  }

  async findRequest(id: string): Promise<VerificationRequest | null> {
    const result = await this.sql.query<RequestRow>(
      "select " + requestColumns + " from identity_private.verification_requests where id = $1 limit 1",
      [id],
    );
    return result.rows[0] ? mapRequest(result.rows[0]) : null;
  }
}
