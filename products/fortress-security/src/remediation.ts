import { createHash } from 'node:crypto';
import type { Finding, ScanReport, Severity } from './types.js';

export type RemediationStatus = 'OPEN' | 'IN_PROGRESS' | 'VERIFIED' | 'REGRESSED';

export interface RemediationRecord {
  id: string;
  findingId: string;
  assetId: string;
  severity: Severity;
  title: string;
  status: RemediationStatus;
  remediation: string;
  firstSeenAt: string;
  lastSeenAt: string;
  verifiedAt?: string;
  verificationDigest?: string;
}

export interface RemediationLedger {
  schemaVersion: '1.0';
  generatedAt: string;
  records: RemediationRecord[];
}

function stableId(finding: Finding): string {
  return createHash('sha256')
    .update(`${finding.assetId}|${finding.kind}|${finding.title}`)
    .digest('hex')
    .slice(0, 20);
}

function findingKey(finding: Finding): string {
  return stableId(finding);
}

export function createLedger(report: ScanReport, previous?: RemediationLedger): RemediationLedger {
  const now = report.completedAt;
  const previousById = new Map((previous?.records ?? []).map(record => [record.id, record]));
  const current = new Map(report.findings.map(finding => [findingKey(finding), finding]));
  const records: RemediationRecord[] = [];

  for (const finding of report.findings) {
    const id = findingKey(finding);
    const old = previousById.get(id);
    records.push({
      id,
      findingId: finding.id,
      assetId: finding.assetId,
      severity: finding.severity,
      title: finding.title,
      status: old?.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'OPEN',
      remediation: finding.remediation,
      firstSeenAt: old?.firstSeenAt ?? report.startedAt,
      lastSeenAt: now,
    });
  }

  if (previous) {
    for (const old of previous.records) {
      if (!current.has(old.id) && old.status !== 'VERIFIED') {
        records.push({ ...old, status: 'VERIFIED', verifiedAt: now, verificationDigest: report.evidenceDigest });
      }
    }
  }

  return { schemaVersion: '1.0', generatedAt: now, records };
}

export function verifyRemediation(previous: RemediationLedger, report: ScanReport): RemediationLedger {
  const now = report.completedAt;
  const current = new Map(report.findings.map(finding => [findingKey(finding), finding]));

  return {
    schemaVersion: '1.0',
    generatedAt: now,
    records: previous.records.map(record => {
      const finding = current.get(record.id);
      if (!finding) {
        return { ...record, status: 'VERIFIED', verifiedAt: now, verificationDigest: report.evidenceDigest };
      }
      return {
        ...record,
        status: record.status === 'VERIFIED' ? 'REGRESSED' : record.status,
        severity: finding.severity,
        lastSeenAt: now,
        remediation: finding.remediation,
      };
    }),
  };
}

export function summarize(ledger: RemediationLedger) {
  return ledger.records.reduce(
    (summary, record) => {
      summary.total += 1;
      summary[record.status] += 1;
      return summary;
    },
    { total: 0, OPEN: 0, IN_PROGRESS: 0, VERIFIED: 0, REGRESSED: 0 } as Record<RemediationStatus | 'total', number>,
  );
}
