import { createHash } from 'node:crypto';
import {
  appendJournalEvent,
  type ControlJournalEvent,
  type JournalEventType,
} from './control-journal';

export type ControlApiOutcome = 'ALLOW' | 'DENY' | 'SUCCESS' | 'FAILED';

export interface ControlApiRequest {
  tenantId: string;
  actorId: string;
  eventType: JournalEventType;
  subjectId: string;
  outcome: ControlApiOutcome;
  timestamp: string;
  correlationId?: string;
  policyId?: string;
  approvalId?: string;
  enforcementDecisionId?: string;
  adapterExecutionId?: string;
  attestationId?: string;
  metadata?: Record<string, string>;
}

export interface ControlApiAccepted {
  accepted: true;
  requestId: string;
  event: ControlJournalEvent;
}

export interface ControlApiRejected {
  accepted: false;
  requestId: string;
  code: 'INVALID_REQUEST' | 'TENANT_MISMATCH';
  reason: string;
}

export type ControlApiResult = ControlApiAccepted | ControlApiRejected;

const EVENT_TYPES = new Set<JournalEventType>([
  'INTELLIGENCE_DECISION',
  'POLICY_EVALUATION',
  'APPROVAL',
  'ENFORCEMENT',
  'ADAPTER_EXECUTION',
  'ATTESTATION',
]);

const OUTCOMES = new Set<ControlApiOutcome>(['ALLOW', 'DENY', 'SUCCESS', 'FAILED']);

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function requestIdentity(request: ControlApiRequest): string {
  return hash(JSON.stringify(request));
}

function validNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validTimestamp(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function normalizedMetadata(request: ControlApiRequest): Record<string, string> {
  return {
    ...(request.metadata ?? {}),
    actorId: request.actorId,
    ...(request.correlationId ? { correlationId: request.correlationId } : {}),
    ...(request.policyId ? { policyId: request.policyId } : {}),
    ...(request.approvalId ? { approvalId: request.approvalId } : {}),
    ...(request.enforcementDecisionId ? { enforcementDecisionId: request.enforcementDecisionId } : {}),
    ...(request.adapterExecutionId ? { adapterExecutionId: request.adapterExecutionId } : {}),
    ...(request.attestationId ? { attestationId: request.attestationId } : {}),
  };
}

export function ingestControlEvent(
  events: readonly ControlJournalEvent[],
  request: ControlApiRequest,
  expectedTenantId?: string,
): ControlApiResult {
  const requestId = requestIdentity(request);

  if (expectedTenantId !== undefined && request.tenantId !== expectedTenantId) {
    return {
      accepted: false,
      requestId,
      code: 'TENANT_MISMATCH',
      reason: 'Request tenant does not match the authorized tenant context.',
    };
  }

  if (
    !validNonEmpty(request.tenantId) ||
    !validNonEmpty(request.actorId) ||
    !validNonEmpty(request.subjectId) ||
    !EVENT_TYPES.has(request.eventType) ||
    !OUTCOMES.has(request.outcome) ||
    !validTimestamp(request.timestamp)
  ) {
    return {
      accepted: false,
      requestId,
      code: 'INVALID_REQUEST',
      reason: 'Required tenant, actor, subject, event type, outcome, or timestamp is invalid.',
    };
  }

  const event = appendJournalEvent(events, {
    tenantId: request.tenantId,
    type: request.eventType,
    subjectId: request.subjectId,
    outcome: request.outcome,
    createdAt: request.timestamp,
    metadata: normalizedMetadata(request),
  });

  return { accepted: true, requestId, event };
}
