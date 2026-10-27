import { createHash } from 'node:crypto';
import type { RemediationLedger } from './remediation.js';
import type { ScanReport } from './types.js';

export interface FortressStore {
  putScan(report: ScanReport): Promise<void>;
  putLedger(ledger: RemediationLedger): Promise<void>;
  getLatestScan(): Promise<ScanReport | null>;
  getLatestLedger(): Promise<RemediationLedger | null>;
  listScans(): Promise<ScanReport[]>;
}

export class FileFortressStore implements FortressStore {
  constructor(private readonly root: string) {}

  async putScan(report: ScanReport): Promise<void> {
    await this.writeJson(`scans/${report.completedAt.replace(/[:.]/g, '-')}.json`, report);
  }

  async putLedger(ledger: RemediationLedger): Promise<void> {
    await this.writeJson('ledger/latest.json', ledger);
  }

  async getLatestScan(): Promise<ScanReport | null> {
    const files = await this.listFiles('scans');
    if (!files.length) return null;
    const latest = files.sort().at(-1)!;
    return this.readJson(`scans/${latest}`) as Promise<ScanReport>;
  }

  async getLatestLedger(): Promise<RemediationLedger | null> {
    try { return await this.readJson('ledger/latest.json') as RemediationLedger; }
    catch { return null; }
  }

  async listScans(): Promise<ScanReport[]> {
    const files = (await this.listFiles('scans')).sort();
    return Promise.all(files.map(file => this.readJson(`scans/${file}`) as Promise<ScanReport>));
  }

  private async writeJson(relative: string, value: unknown): Promise<void> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const target = path.join(this.root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const body = JSON.stringify(value, null, 2) + '\n';
    await fs.writeFile(target, body, 'utf8');
  }

  private async readJson(relative: string): Promise<unknown> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    return JSON.parse(await fs.readFile(path.join(this.root, relative), 'utf8'));
  }

  private async listFiles(relative: string): Promise<string[]> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    try { return await fs.readdir(path.join(this.root, relative)); }
    catch { return []; }
  }
}

export function storeKey(report: ScanReport): string {
  return createHash('sha256').update(`${report.scopeOwner}|${report.completedAt}|${report.evidenceDigest}`).digest('hex');
}
