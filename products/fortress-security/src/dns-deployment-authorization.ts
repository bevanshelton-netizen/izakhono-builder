import { authorize, type FortressPrincipal } from './access-control.js';
import { createAuditEvent, type AuditEvent } from './audit-log.js';

export interface DnsDeploymentIntent {
  tenantId: string;
  zoneId: string;
  zoneName: string;
  desiredSerial: number;
  environment: 'production';
  approvalId: string;
}

export interface DnsDeploymentApproval {
  id: string;
  tenantId: string;
  action: 'dns.publish';
  resource: string;
  zoneName: string;
  desiredSerial: number;
  environment: 'production';
  decision: 'APPROVED' | 'DENIED';
  approverId: string;
  expiresAt: string;
}

export type DnsApprovalResolver = (approvalId: string) => Promise<DnsDeploymentApproval | null>;
export type FortressAuditWriter = (event: AuditEvent) => Promise<void>;

export interface DnsDeploymentDecision {
  allowed: boolean;
  authorizationId: string | null;
  auditEventId: string;
  reason: string;
}

function resourceFor(zoneId: string): string {
  return `dns-zone:${zoneId}`;
}

function validateIntent(intent: DnsDeploymentIntent): void {
  if (!intent.tenantId?.trim() || !intent.zoneId?.trim() || !intent.approvalId?.trim()) {
    throw new Error('tenant, zone and approval identifiers are required');
  }
  const zone = intent.zoneName?.trim().toLowerCase().replace(/\.$/, '');
  if (!zone || zone.length > 253 || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(zone)) {
    throw new Error('a valid DNS zone name is required');
  }
  if (!Number.isSafeInteger(intent.desiredSerial) || intent.desiredSerial < 1) {
    throw new Error('a positive desired DNS serial is required');
  }
  if (intent.environment !== 'production') throw new Error('only explicit production DNS intents are supported');
}

/**
 * Fail-closed FORTRESS authorization for a DNS publication attempt.
 *
 * The approval resolver must read a durable approval record; the audit writer
 * must durably append the decision. An allow decision is returned only after
 * both exact-scope approval verification and successful audit acknowledgement.
 */
export async function authorizeDnsDeployment(
  principal: FortressPrincipal,
  intent: DnsDeploymentIntent,
  resolveApproval: DnsApprovalResolver,
  appendAudit: FortressAuditWriter,
  now = new Date(),
): Promise<DnsDeploymentDecision> {
  let allowed = false;
  let authorizationId: string | null = null;
  let reason = 'DNS publication denied';
  try {
    validateIntent(intent);
    authorize(principal, intent.tenantId, 'dns:publish');
    const approval = await resolveApproval(intent.approvalId);
    if (!approval) throw new Error('durable FORTRESS approval was not found');
    if (
      approval.id !== intent.approvalId ||
      approval.tenantId !== intent.tenantId ||
      approval.action !== 'dns.publish' ||
      approval.resource !== resourceFor(intent.zoneId) ||
      approval.zoneName.toLowerCase().replace(/\.$/, '') !== intent.zoneName.toLowerCase().replace(/\.$/, '') ||
      approval.desiredSerial !== intent.desiredSerial ||
      approval.environment !== intent.environment ||
      approval.decision !== 'APPROVED'
    ) throw new Error('FORTRESS approval does not match the exact tenant, zone, serial and environment');
    if (!approval.approverId?.trim() || approval.approverId === principal.id) {
      throw new Error('DNS publication approval must be issued by a different active approver');
    }
    const expiry = Date.parse(approval.expiresAt);
    if (!Number.isFinite(expiry) || expiry <= now.getTime()) throw new Error('FORTRESS approval is expired or invalid');
    allowed = true;
    authorizationId = approval.id;
    reason = 'exact-scope FORTRESS approval verified';
  } catch (error) {
    reason = error instanceof Error ? error.message : 'DNS publication authorization failed';
  }

  const event = createAuditEvent({
    principalId: principal.id,
    tenantId: intent.tenantId,
    action: 'dns.publish',
    resource: resourceFor(intent.zoneId),
    outcome: allowed ? 'ALLOWED' : 'DENIED',
    reason,
  });
  // Audit failure is fatal: never return an allow decision without durable acknowledgement.
  await appendAudit(event);
  return { allowed, authorizationId, auditEventId: event.id, reason };
}
