import { createHash } from 'node:crypto';

export type IntelligenceAction =
  | 'NOTIFY_SECURITY_ADMIN'
  | 'ESCALATE_CRITICAL'
  | 'REQUEST_RESCAN'
  | 'OPEN_REMEDIATION'
  | 'MARK_REGRESSION'
  | 'REQUIRE_REVIEW';

export type IntelligencePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface IntelligenceSignal {
  tenantId: string;
  type: 'NEW_FINDING' | 'REGRESSION' | 'RISK_SPIKE' | 'STALE_SCAN' | 'CERTIFICATE_EXPIRY' | 'REPEATED_FAILURE';
  severity: IntelligencePriority;
  targetId: string;
  observedAt: string;
  evidenceDigest?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface IntelligenceDecision {
  id: string;
  tenantId: string;
  signalType: IntelligenceSignal['type'];
  priority: IntelligencePriority;
  actions: IntelligenceAction[];
  createdAt: string;
  rationale: string;
  integrityHash: string;
}

const canonical = (value: Omit<IntelligenceDecision, 'integrityHash'>) => JSON.stringify(value);

const priorityRank: Record<IntelligencePriority, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export function decide(signal: IntelligenceSignal, now = signal.observedAt): IntelligenceDecision {
  const actions = new Set<IntelligenceAction>();
  if (signal.severity === 'CRITICAL') {
    actions.add('ESCALATE_CRITICAL');
    actions.add('NOTIFY_SECURITY_ADMIN');
    actions.add('REQUIRE_REVIEW');
  } else if (signal.severity === 'HIGH') {
    actions.add('NOTIFY_SECURITY_ADMIN');
    actions.add('OPEN_REMEDIATION');
  } else {
    actions.add('REQUIRE_REVIEW');
  }
  if (signal.type === 'REGRESSION') actions.add('MARK_REGRESSION');
  if (signal.type === 'RISK_SPIKE' || signal.type === 'STALE_SCAN') actions.add('REQUEST_RESCAN');
  if (signal.type === 'CERTIFICATE_EXPIRY' && priorityRank[signal.severity] >= priorityRank.HIGH) actions.add('REQUEST_RESCAN');
  if (signal.type === 'REPEATED_FAILURE') actions.add('OPEN_REMEDIATION');

  const base = {
    id: createHash('sha256').update(JSON.stringify(signal)).digest('hex').slice(0, 24),
    tenantId: signal.tenantId,
    signalType: signal.type,
    priority: signal.severity,
    actions: [...actions].sort(),
    createdAt: now,
    rationale: `${signal.type} signal for ${signal.targetId} at ${signal.severity} priority`,
  };
  return { ...base, integrityHash: createHash('sha256').update(canonical(base)).digest('hex') };
}

export function verifyDecisionIntegrity(decision: IntelligenceDecision): boolean {
  const { integrityHash, ...base } = decision;
  return createHash('sha256').update(canonical(base)).digest('hex') === integrityHash;
}

export function isolateTenant(decisions: IntelligenceDecision[], tenantId: string): IntelligenceDecision[] {
  return decisions.filter((decision) => decision.tenantId === tenantId);
}
