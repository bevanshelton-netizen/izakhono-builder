import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileEvidenceVault, contentDigest } from './vault.js';

describe('FileEvidenceVault', () => {
  it('stores and retrieves only within the requested tenant', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fortress-vault-'));
    const vault = new FileEvidenceVault(root);
    const createdAt = '2026-10-27T18:00:00.000Z';
    const a = await vault.put({ tenantId: 'tenant-a', classification: 'SECURITY_EVIDENCE', createdAt, metadata: {}, body: 'evidence-a' });
    await vault.put({ tenantId: 'tenant-b', classification: 'SECURITY_EVIDENCE', createdAt, metadata: {}, body: 'evidence-b' });
    expect(await vault.get('tenant-a', a.id)).toMatchObject({ tenantId: 'tenant-a', body: 'evidence-a' });
    expect(await vault.get('tenant-b', a.id)).toBeNull();
    expect((await vault.list('tenant-a')).map(x => x.body)).toEqual(['evidence-a']);
    expect(contentDigest('evidence-a')).toBe(a.contentDigest);
  });

  it('purges objects past their retention deadline', async () => {
    const root = await mkdtemp(join(tmpdir(), 'fortress-vault-'));
    const vault = new FileEvidenceVault(root);
    const object = await vault.put({ tenantId: 'tenant-a', classification: 'REPORT', createdAt: '2026-10-27T18:00:00.000Z', retentionUntil: '2026-10-27T19:00:00.000Z', metadata: {}, body: 'report' });
    expect(await vault.get('tenant-a', object.id)).not.toBeNull();
    expect(await vault.purgeExpired('2026-10-27T19:00:01.000Z')).toBe(1);
    expect(await vault.get('tenant-a', object.id)).toBeNull();
  });
});
