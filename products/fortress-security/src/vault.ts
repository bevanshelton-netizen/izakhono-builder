import { createHash } from 'node:crypto';

export type VaultClassification = 'SECURITY_EVIDENCE' | 'AUDIT_RECORD' | 'REPORT';

export interface VaultObject {
  id: string;
  tenantId: string;
  classification: VaultClassification;
  createdAt: string;
  contentDigest: string;
  size: number;
  retentionUntil?: string;
  metadata: Record<string, string>;
  body: string;
}

export interface EvidenceVault {
  put(input: Omit<VaultObject, 'id' | 'contentDigest' | 'size'>): Promise<VaultObject>;
  get(tenantId: string, id: string): Promise<VaultObject | null>;
  list(tenantId: string, classification?: VaultClassification): Promise<VaultObject[]>;
  purgeExpired(now?: string): Promise<number>;
}

export function vaultObjectId(tenantId: string, classification: VaultClassification, createdAt: string, body: string): string {
  return createHash('sha256').update(`${tenantId}|${classification}|${createdAt}|${body}`).digest('hex');
}

export function contentDigest(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

export class FileEvidenceVault implements EvidenceVault {
  constructor(private readonly root: string) {}

  async put(input: Omit<VaultObject, 'id' | 'contentDigest' | 'size'>): Promise<VaultObject> {
    if (!input.tenantId.trim()) throw new Error('tenantId is required');
    if (!input.body) throw new Error('vault body is required');
    const object: VaultObject = {
      ...input,
      id: vaultObjectId(input.tenantId, input.classification, input.createdAt, input.body),
      contentDigest: contentDigest(input.body),
      size: Buffer.byteLength(input.body, 'utf8'),
    };
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const target = path.join(this.root, input.tenantId, input.classification, `${object.id}.json`);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, JSON.stringify(object, null, 2) + '\n', 'utf8');
    return object;
  }

  async get(tenantId: string, id: string): Promise<VaultObject | null> {
    if (!tenantId.trim()) throw new Error('tenantId is required');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    for (const classification of ['SECURITY_EVIDENCE','AUDIT_RECORD','REPORT'] as VaultClassification[]) {
      try { return JSON.parse(await fs.readFile(path.join(this.root, tenantId, classification, `${id}.json`), 'utf8')) as VaultObject; }
      catch { /* continue */ }
    }
    return null;
  }

  async list(tenantId: string, classification?: VaultClassification): Promise<VaultObject[]> {
    if (!tenantId.trim()) throw new Error('tenantId is required');
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const classes = classification ? [classification] : ['SECURITY_EVIDENCE','AUDIT_RECORD','REPORT'] as VaultClassification[];
    const result: VaultObject[] = [];
    for (const kind of classes) {
      try {
        for (const file of await fs.readdir(path.join(this.root, tenantId, kind))) {
          if (!file.endsWith('.json')) continue;
          result.push(JSON.parse(await fs.readFile(path.join(this.root, tenantId, kind, file), 'utf8')) as VaultObject);
        }
      } catch { /* absent classification is empty */ }
    }
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async purgeExpired(now = new Date().toISOString()): Promise<number> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    let removed = 0;
    try {
      for (const tenantId of await fs.readdir(this.root)) {
        for (const kind of ['SECURITY_EVIDENCE','AUDIT_RECORD','REPORT'] as VaultClassification[]) {
          const dir = path.join(this.root, tenantId, kind);
          try {
            for (const file of await fs.readdir(dir)) {
              const full = path.join(dir, file);
              const value = JSON.parse(await fs.readFile(full, 'utf8')) as VaultObject;
              if (value.retentionUntil && value.retentionUntil <= now) { await fs.unlink(full); removed++; }
            }
          } catch { /* absent directory */ }
        }
      }
    } catch { /* empty vault */ }
    return removed;
  }
}
