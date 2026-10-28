import { createHash } from 'node:crypto';

export type ReportRole = 'OWNER' | 'SECURITY_ADMIN' | 'ANALYST' | 'VIEWER';

export type ReportFinding = {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';
  title: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'VERIFIED' | 'REGRESSED';
  evidenceDigest?: string;
};

export type SecurityReportInput = {
  tenantId: string;
  actorId: string;
  role: ReportRole;
  generatedAt: string;
  scope: string[];
  scanIds: string[];
  findings: ReportFinding[];
  riskScore: number;
};

export type SecurityReport = SecurityReportInput & {
  reportId: string;
  summary: {
    totalFindings: number;
    severity: Record<ReportFinding['severity'], number>;
    remediation: Record<'OPEN' | 'IN_PROGRESS' | 'VERIFIED' | 'REGRESSED', number>;
  };
  integrityDigest: string;
};

const EXPORT_ROLES = new Set<ReportRole>(['OWNER', 'SECURITY_ADMIN', 'ANALYST']);

function canonical(input: Omit<SecurityReport, 'integrityDigest'>): string {
  return JSON.stringify(input);
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function canExportReport(role: ReportRole): boolean {
  return EXPORT_ROLES.has(role);
}

export function createSecurityReport(input: SecurityReportInput): SecurityReport {
  if (!input.tenantId || !input.actorId) throw new Error('tenant and actor are required');
  if (!canExportReport(input.role)) throw new Error('report export denied for role');
  if (!Number.isFinite(input.riskScore) || input.riskScore < 0 || input.riskScore > 100) {
    throw new Error('risk score must be between 0 and 100');
  }

  const severity = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 } as SecurityReport['summary']['severity'];
  const remediation = { OPEN: 0, IN_PROGRESS: 0, VERIFIED: 0, REGRESSED: 0 } as SecurityReport['summary']['remediation'];
  for (const finding of input.findings) {
    severity[finding.severity] += 1;
    if (finding.status) remediation[finding.status] += 1;
  }

  const base = {
    ...input,
    reportId: digest(JSON.stringify({ tenantId: input.tenantId, actorId: input.actorId, generatedAt: input.generatedAt, scanIds: input.scanIds })).slice(0, 24),
    summary: { totalFindings: input.findings.length, severity, remediation },
  };

  return { ...base, integrityDigest: digest(canonical(base)) };
}

export function verifySecurityReport(report: SecurityReport): boolean {
  const { integrityDigest, ...base } = report;
  return digest(canonical(base)) === integrityDigest;
}

export function redactReport(report: SecurityReport): SecurityReport {
  return {
    ...report,
    findings: report.findings.map((finding) => ({
      ...finding,
      title: finding.title.replace(/(password|secret|token|api[-_ ]?key)=?\S*/gi, '$1=[REDACTED]'),
    })),
  };
}

export function renderMarkdownReport(report: SecurityReport): string {
  return [
    '# FORTRESS Security Report',
    '',
    `- Tenant: ${report.tenantId}`,
    `- Report ID: ${report.reportId}`,
    `- Generated: ${report.generatedAt}`,
    `- Risk score: ${report.riskScore}/100`,
    `- Assets/scopes: ${report.scope.length}`,
    `- Scans: ${report.scanIds.length}`,
    `- Findings: ${report.summary.totalFindings}`,
    '',
    '## Severity',
    ...Object.entries(report.summary.severity).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Remediation',
    ...Object.entries(report.summary.remediation).map(([k, v]) => `- ${k}: ${v}`),
    '',
    `Integrity digest: ${report.integrityDigest}`,
  ].join('\n');
}
