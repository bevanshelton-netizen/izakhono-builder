import { createHash } from 'node:crypto';

export type RiskAlertType = 'NEW_CRITICAL' | 'NEW_HIGH' | 'REGRESSION' | 'RISK_JUMP' | 'STALE_SCAN' | 'CERTIFICATE_EXPIRY' | 'REPEATED_FAILURE';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';

export interface RiskEvent {
  tenantId: string;
  type: RiskAlertType;
  targetId: string;
  occurredAt: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  riskScore?: number;
  previousRiskScore?: number;
  fingerprint?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface RiskPolicy {
  riskJumpPoints: number;
  staleAfterHours: number;
  certificateExpiryDays: number;
  repeatedFailureCount: number;
  dedupeWindowMinutes: number;
}

export interface RiskAlert {
  id: string;
  tenantId: string;
  type: RiskAlertType;
  targetId: string;
  severity: RiskEvent['severity'];
  status: AlertStatus;
  createdAt: string;
  fingerprint: string;
  metadata: Record<string, string | number | boolean>;
}

export const DEFAULT_RISK_POLICY: RiskPolicy = {
  riskJumpPoints: 15,
  staleAfterHours: 24,
  certificateExpiryDays: 14,
  repeatedFailureCount: 3,
  dedupeWindowMinutes: 60,
};

const stable = (value: unknown) => JSON.stringify(value, Object.keys(value as object).sort());
const fingerprintFor = (event: RiskEvent) => event.fingerprint ?? createHash('sha256').update(stable({ tenantId: event.tenantId, type: event.type, targetId: event.targetId })).digest('hex');

export function evaluateRiskEvents(input: {
  tenantId: string;
  now: string;
  lastScanAt?: string;
  currentRiskScore: number;
  previousRiskScore?: number;
  newFindings?: Array<{ id: string; severity: 'CRITICAL' | 'HIGH' }>;
  regressions?: string[];
  certificateExpiryAt?: string;
  consecutiveFailures?: number;
  policy?: Partial<RiskPolicy>;
}): RiskEvent[] {
  const policy = { ...DEFAULT_RISK_POLICY, ...input.policy };
  const events: RiskEvent[] = [];
  for (const finding of input.newFindings ?? []) events.push({ tenantId: input.tenantId, type: finding.severity === 'CRITICAL' ? 'NEW_CRITICAL' : 'NEW_HIGH', targetId: finding.id, occurredAt: input.now, severity: finding.severity });
  for (const id of input.regressions ?? []) events.push({ tenantId: input.tenantId, type: 'REGRESSION', targetId: id, occurredAt: input.now, severity: 'HIGH' });
  if (input.previousRiskScore !== undefined && input.currentRiskScore - input.previousRiskScore >= policy.riskJumpPoints) events.push({ tenantId: input.tenantId, type: 'RISK_JUMP', targetId: input.tenantId, occurredAt: input.now, severity: 'HIGH', riskScore: input.currentRiskScore, previousRiskScore: input.previousRiskScore });
  if (input.lastScanAt && Date.parse(input.now) - Date.parse(input.lastScanAt) >= policy.staleAfterHours * 3600000) events.push({ tenantId: input.tenantId, type: 'STALE_SCAN', targetId: input.tenantId, occurredAt: input.now, severity: 'MEDIUM' });
  if (input.certificateExpiryAt && Date.parse(input.certificateExpiryAt) - Date.parse(input.now) <= policy.certificateExpiryDays * 86400000) events.push({ tenantId: input.tenantId, type: 'CERTIFICATE_EXPIRY', targetId: input.tenantId, occurredAt: input.now, severity: 'HIGH' });
  if ((input.consecutiveFailures ?? 0) >= policy.repeatedFailureCount) events.push({ tenantId: input.tenantId, type: 'REPEATED_FAILURE', targetId: input.tenantId, occurredAt: input.now, severity: 'HIGH', metadata: { consecutiveFailures: input.consecutiveFailures ?? 0 } });
  return events;
}

export function materializeAlerts(events: RiskEvent[], existing: RiskAlert[] = [], policy: Partial<RiskPolicy> = {}): RiskAlert[] {
  const windowMs = (policy.dedupeWindowMinutes ?? DEFAULT_RISK_POLICY.dedupeWindowMinutes) * 60000;
  const alerts = [...existing];
  for (const event of events) {
    const fingerprint = fingerprintFor(event);
    const duplicate = alerts.some(a => a.tenantId === event.tenantId && a.fingerprint === fingerprint && Date.parse(event.occurredAt) - Date.parse(a.createdAt) < windowMs && a.status !== 'RESOLVED');
    if (duplicate) continue;
    const id = createHash('sha256').update(stable({ fingerprint, occurredAt: event.occurredAt })).digest('hex');
    alerts.push({ id, tenantId: event.tenantId, type: event.type, targetId: event.targetId, severity: event.severity, status: 'OPEN', createdAt: event.occurredAt, fingerprint, metadata: event.metadata ?? {} });
  }
  return alerts;
}

export function transitionAlert(alert: RiskAlert, status: AlertStatus, tenantId: string): RiskAlert {
  if (alert.tenantId !== tenantId) throw new Error('cross-tenant alert access denied');
  if (alert.status === 'RESOLVED' && status !== 'RESOLVED') throw new Error('resolved alert cannot be reopened by lifecycle transition');
  return { ...alert, status };
}
