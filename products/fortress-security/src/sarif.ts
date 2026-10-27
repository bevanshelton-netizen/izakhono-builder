import type { Finding, ScanReport, Severity } from './types.js';

const level: Record<Severity, 'error' | 'warning' | 'note' | 'none'> = {
  CRITICAL: 'error',
  HIGH: 'error',
  MEDIUM: 'warning',
  LOW: 'note',
  INFO: 'note'
};

function ruleId(finding: Finding): string {
  return `FORTRESS/${finding.kind}/${finding.title.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export interface SarifLog {
  version: '2.1.0';
  $schema: string;
  runs: Array<{
    tool: { driver: { name: string; version: string; informationUri: string; rules: Array<Record<string, unknown>> } };
    results: Array<Record<string, unknown>>;
  }>;
}

export function toSarif(report: ScanReport): SarifLog {
  const rules = new Map<string, Record<string, unknown>>();
  for (const finding of report.findings) {
    const id = ruleId(finding);
    rules.set(id, {
      id,
      name: id.replace(/^FORTRESS\//, ''),
      shortDescription: { text: finding.title },
      fullDescription: { text: finding.description },
      help: { text: finding.remediation },
      properties: { severity: finding.severity, kind: finding.kind }
    });
  }

  return {
    version: '2.1.0',
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    runs: [{
      tool: {
        driver: {
          name: 'IZAKHONO FORTRESS SECURITY',
          version: '1.0.0',
          informationUri: 'https://github.com/bevanshelton-netizen/izakhono-builder',
          rules: [...rules.values()]
        }
      },
      results: report.findings.map(finding => {
        const id = ruleId(finding);
        return {
          ruleId: id,
          level: level[finding.severity],
          message: { text: `${finding.description} Evidence: ${finding.evidence}` },
          fingerprints: { fortressFindingId: finding.id },
          properties: {
            severity: finding.severity,
            assetId: finding.assetId,
            remediation: finding.remediation
          }
        };
      })
    }]
  };
}
