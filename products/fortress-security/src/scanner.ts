import { createHash } from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import type { Finding, ScanAsset, ScanReport, Severity } from './types.js';
import type { ScanScope } from './types.js';
import { validateScope } from './policy.js';

const severityRank: Record<Severity, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

function finding(assetId: string, severity: Severity, kind: Finding['kind'], title: string, description: string, evidence: string, remediation: string): Finding {
  const id = createHash('sha256').update([assetId, severity, kind, title, evidence].join('|')).digest('hex').slice(0, 16);
  return { id, assetId, severity, kind, title, description, evidence, remediation };
}

function tcpConnect(host: string, port: number, timeoutMs = 2500): Promise<boolean> {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (open: boolean) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
  });
}

async function inspectHttp(asset: ScanAsset, url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  let response: Response;
  try {
    response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5000) });
  } catch (error) {
    findings.push(finding(asset.id, 'INFO', 'HTTP', 'HTTP endpoint unreachable', 'The explicitly scoped HTTP endpoint did not return a response.', String(error), 'Confirm the service is intentionally reachable and that monitoring can reach it.'));
    return findings;
  }

  const headers = response.headers;
  const requiredHeaders: Array<[string, Severity, string]> = [
    ['content-security-policy', 'MEDIUM', 'Define a restrictive Content-Security-Policy appropriate to the application.'],
    ['strict-transport-security', 'MEDIUM', 'Enable HSTS after HTTPS is confirmed across the intended domain.'],
    ['x-content-type-options', 'LOW', 'Set X-Content-Type-Options: nosniff.'],
    ['referrer-policy', 'LOW', 'Set an explicit Referrer-Policy.']
  ];
  for (const [header, severity, remediation] of requiredHeaders) {
    if (!headers.has(header)) {
      findings.push(finding(asset.id, severity, 'HTTP', `Missing ${header}`, `The response does not expose the recommended security header ${header}.`, `URL=${url}; status=${response.status}; missing=${header}`, remediation));
    }
  }

  const allow = headers.get('allow') ?? '';
  if (allow.toUpperCase().includes('TRACE')) {
    findings.push(finding(asset.id, 'MEDIUM', 'HTTP', 'HTTP TRACE is advertised', 'The endpoint advertises TRACE in its Allow header.', `URL=${url}; Allow=${allow}`, 'Disable TRACE unless a documented legacy requirement exists.'));
  }

  const server = headers.get('server');
  if (server) {
    findings.push(finding(asset.id, 'LOW', 'HTTP', 'Server banner disclosed', 'The HTTP response exposes a server identification banner.', `URL=${url}; Server=${server}`, 'Minimize unnecessary version/product disclosure at the edge.'));
  }

  for (const path of ['/phpinfo.php', '/.env']) {
    try {
      const probe = new URL(path, url).toString();
      const r = await fetch(probe, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(3000) });
      if (r.status >= 200 && r.status < 400) {
        findings.push(finding(asset.id, 'HIGH', 'HTTP', `Potentially exposed ${path}`, `A commonly sensitive path returned a successful response to a non-destructive HEAD request.`, `URL=${probe}; status=${r.status}`, `Remove ${path} from public web roots or deny it at the edge. Do not expose runtime diagnostics or environment files.`));
      }
    } catch { /* endpoint not reachable; no finding */ }
  }
  return findings;
}

function inspectTls(asset: ScanAsset, url: string): Promise<Finding[]> {
  return new Promise(resolve => {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return resolve([]);
    const port = Number(parsed.port || 443);
    const socket = tls.connect({ host: parsed.hostname, port, servername: parsed.hostname, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      const findings: Finding[] = [];
      if (cert?.valid_to) {
        const expiry = new Date(cert.valid_to).getTime();
        const days = Math.floor((expiry - Date.now()) / 86_400_000);
        if (days < 0) findings.push(finding(asset.id, 'CRITICAL', 'TLS', 'TLS certificate expired', 'The peer certificate is expired.', `host=${parsed.hostname}; valid_to=${cert.valid_to}`, 'Renew the certificate and verify the complete TLS chain.'));
        else if (days < 30) findings.push(finding(asset.id, 'HIGH', 'TLS', 'TLS certificate expires soon', `The peer certificate expires in approximately ${days} days.`, `host=${parsed.hostname}; valid_to=${cert.valid_to}; days=${days}`, 'Renew the certificate before expiry and verify automated renewal.'));
      }
      if (socket.authorizationError) {
        findings.push(finding(asset.id, 'HIGH', 'TLS', 'TLS certificate validation error', 'The TLS peer presented a certificate that did not validate cleanly under the local trust policy.', `host=${parsed.hostname}; error=${socket.authorizationError}`, 'Install a valid publicly trusted or intentionally trusted certificate and verify hostname/chain configuration.'));
      }
      socket.end();
      resolve(findings);
    });
    socket.setTimeout(4000, () => { socket.destroy(); resolve([]); });
    socket.once('error', () => resolve([]));
  });
}

async function inspectPorts(asset: ScanAsset): Promise<Finding[]> {
  const findings: Finding[] = [];
  const servicePorts: Record<number, [Severity, string, string]> = {
    21: ['HIGH', 'FTP service exposed', 'Prefer SFTP/FTPS or a tightly controlled internal transfer service; disable anonymous access.'],
    22: ['INFO', 'SSH service exposed', 'Keep SSH restricted to trusted administration networks and use modern authentication and cryptography.'],
    23: ['CRITICAL', 'Telnet service exposed', 'Disable Telnet and replace it with SSH or another encrypted management protocol.'],
    25: ['MEDIUM', 'SMTP service exposed', 'Restrict relay behavior and expose SMTP only where operationally required.'],
    445: ['HIGH', 'SMB service exposed', 'Restrict SMB to trusted networks and disable legacy SMBv1 where not required.'],
    5900: ['HIGH', 'VNC service exposed', 'Restrict VNC behind authenticated, encrypted administration paths; never rely on default credentials.'],
    5432: ['HIGH', 'PostgreSQL service exposed', 'Do not expose database services publicly; restrict by network policy and strong authentication.'],
    3306: ['HIGH', 'MySQL service exposed', 'Do not expose database services publicly; restrict by network policy and strong authentication.'],
    6379: ['HIGH', 'Redis service exposed', 'Restrict Redis to trusted application networks and require authentication/TLS where supported.'],
    9200: ['HIGH', 'Elasticsearch service exposed', 'Restrict the service and require authentication; do not expose administrative APIs publicly.']
  };

  for (const port of asset.ports) {
    if (!(await tcpConnect(asset.host, port))) continue;
    const meta = servicePorts[port];
    if (meta) findings.push(finding(asset.id, meta[0], 'TCP', meta[1], 'A service on a security-sensitive/common administration port accepted a TCP connection.', `host=${asset.host}; port=${port}; transport=tcp-connect-only`, meta[2]));
    else findings.push(finding(asset.id, 'INFO', 'TCP', `TCP port ${port} reachable`, 'An explicitly scoped TCP port accepted a connection.', `host=${asset.host}; port=${port}`, 'Confirm the service is required and protected by network policy.'));
  }
  return findings;
}

export async function scan(scope: ScanScope): Promise<ScanReport> {
  validateScope(scope);
  const startedAt = new Date().toISOString();
  const findings: Finding[] = [];

  for (const asset of scope.assets) {
    findings.push(...await inspectPorts(asset));
    for (const url of asset.httpUrls ?? []) {
      findings.push(...await inspectHttp(asset, url));
      findings.push(...await inspectTls(asset, url));
    }
  }

  findings.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || a.assetId.localeCompare(b.assetId) || a.id.localeCompare(b.id));
  const canonical = JSON.stringify(findings);
  const evidenceDigest = createHash('sha256').update(canonical).digest('hex');
  return {
    schemaVersion: '1.0',
    scanner: 'IZAKHONO-FORTRESS-SECURITY',
    startedAt,
    completedAt: new Date().toISOString(),
    scopeOwner: scope.owner,
    assetsScanned: scope.assets.length,
    findings,
    evidenceDigest
  };
}
