import { createHash } from 'node:crypto';

export type DashboardSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
export type DashboardTrend = 'IMPROVING' | 'STABLE' | 'WORSENING';

export interface DashboardFinding { severity: DashboardSeverity; status: 'OPEN' | 'IN_PROGRESS' | 'VERIFIED' | 'REGRESSED'; }
export interface DashboardScan { id: string; completedAt: string; findingCount: number; riskScore: number; }
export interface SecurityOperationsDashboard {
  tenantId: string;
  generatedAt: string;
  riskScore: number;
  trend: DashboardTrend;
  assets: number;
  scans: number;
  findings: number;
  severity: Record<DashboardSeverity, number>;
  remediation: Record<'OPEN' | 'IN_PROGRESS' | 'VERIFIED' | 'REGRESSED', number>;
  recentScans: DashboardScan[];
  integrityHash: string;
}

const canonical = (value: Omit<SecurityOperationsDashboard, 'integrityHash'>) => JSON.stringify(value);

export function buildDashboard(input: {
  tenantId: string;
  generatedAt: string;
  assets: number;
  findings: DashboardFinding[];
  scans: DashboardScan[];
  riskScore: number;
}): SecurityOperationsDashboard {
  const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } as Record<DashboardSeverity, number>;
  const remediation = { OPEN: 0, IN_PROGRESS: 0, VERIFIED: 0, REGRESSED: 0 } as Record<'OPEN' | 'IN_PROGRESS' | 'VERIFIED' | 'REGRESSED', number>;
  for (const finding of input.findings) { severity[finding.severity]++; remediation[finding.status]++; }
  const scans = [...input.scans].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const trend = scans.length < 2 ? 'STABLE' : scans[0].riskScore < scans[1].riskScore ? 'IMPROVING' : scans[0].riskScore > scans[1].riskScore ? 'WORSENING' : 'STABLE';
  const base = { tenantId: input.tenantId, generatedAt: input.generatedAt, riskScore: input.riskScore, trend, assets: input.assets, scans: scans.length, findings: input.findings.length, severity, remediation, recentScans: scans.slice(0, 10) };
  return { ...base, integrityHash: createHash('sha256').update(canonical(base)).digest('hex') };
}

export function verifyDashboardIntegrity(dashboard: SecurityOperationsDashboard): boolean {
  const { integrityHash, ...base } = dashboard;
  return createHash('sha256').update(canonical(base)).digest('hex') === integrityHash;
}
