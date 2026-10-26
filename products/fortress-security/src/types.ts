export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type CheckKind = 'HTTP' | 'TLS' | 'TCP';

export interface ScanAsset {
  id: string;
  host: string;
  ports: number[];
  httpUrls?: string[];
}

export interface ScanScope {
  owner: string;
  assets: ScanAsset[];
}

export interface Finding {
  id: string;
  assetId: string;
  severity: Severity;
  kind: CheckKind;
  title: string;
  description: string;
  evidence: string;
  remediation: string;
  references?: string[];
}

export interface ScanReport {
  schemaVersion: '1.0';
  scanner: 'IZAKHONO-FORTRESS-SECURITY';
  startedAt: string;
  completedAt: string;
  scopeOwner: string;
  assetsScanned: number;
  findings: Finding[];
  evidenceDigest: string;
}
