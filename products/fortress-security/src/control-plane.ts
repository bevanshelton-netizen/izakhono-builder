export type FindingState = 'OPEN' | 'IN_PROGRESS' | 'VERIFIED' | 'REGRESSED';
export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export interface FindingRecord {
  id: string;
  assetId: string;
  title: string;
  severity: Severity;
  state: FindingState;
  firstSeen: string;
  lastSeen: string;
  evidenceDigest?: string;
  remediationId?: string;
}

export interface ScanRecord {
  id: string;
  assetId: string;
  startedAt: string;
  completedAt: string;
  findings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface ControlPlaneSnapshot {
  generatedAt: string;
  assets: number;
  scans: number;
  findings: number;
  open: number;
  inProgress: number;
  verified: number;
  regressed: number;
  riskScore: number;
  findingsBySeverity: Record<Severity, number>;
  recentScans: ScanRecord[];
}

const WEIGHTS: Record<Severity, number> = {
  CRITICAL: 10,
  HIGH: 7,
  MEDIUM: 4,
  LOW: 1,
  INFO: 0,
};

export function buildSnapshot(
  findings: FindingRecord[],
  scans: ScanRecord[],
  assetCount: number,
  now = new Date().toISOString(),
): ControlPlaneSnapshot {
  const findingsBySeverity: Record<Severity, number> = {
    CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0,
  };
  let weighted = 0;
  for (const finding of findings) {
    findingsBySeverity[finding.severity] += 1;
    if (finding.state === 'OPEN' || finding.state === 'IN_PROGRESS' || finding.state === 'REGRESSED') {
      weighted += WEIGHTS[finding.severity];
    }
  }

  const maxRisk = Math.max(1, assetCount * 10);
  const riskScore = Math.min(100, Math.round((weighted / maxRisk) * 100));

  return {
    generatedAt: now,
    assets: assetCount,
    scans: scans.length,
    findings: findings.length,
    open: findings.filter(f => f.state === 'OPEN').length,
    inProgress: findings.filter(f => f.state === 'IN_PROGRESS').length,
    verified: findings.filter(f => f.state === 'VERIFIED').length,
    regressed: findings.filter(f => f.state === 'REGRESSED').length,
    riskScore,
    findingsBySeverity,
    recentScans: [...scans].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).slice(0, 10),
  };
}

export function renderControlPlane(snapshot: ControlPlaneSnapshot): string {
  return [
    'IZAKHONO FORTRESS SECURITY CONTROL PLANE',
    `Generated: ${snapshot.generatedAt}`,
    `Assets: ${snapshot.assets} | Scans: ${snapshot.scans} | Findings: ${snapshot.findings}`,
    `Risk score: ${snapshot.riskScore}/100`,
    `State: OPEN=${snapshot.open} IN_PROGRESS=${snapshot.inProgress} VERIFIED=${snapshot.verified} REGRESSED=${snapshot.regressed}`,
    `Severity: CRITICAL=${snapshot.findingsBySeverity.CRITICAL} HIGH=${snapshot.findingsBySeverity.HIGH} MEDIUM=${snapshot.findingsBySeverity.MEDIUM} LOW=${snapshot.findingsBySeverity.LOW} INFO=${snapshot.findingsBySeverity.INFO}`,
  ].join('\n');
}
