import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { FileFortressStore, storeKey } from './store.js';
import type { ScanReport } from './types.js';

const root = await fs.mkdtemp(path.join(os.tmpdir(), 'fortress-'));
const store = new FileFortressStore(root);
const report: ScanReport = {
  schemaVersion: '1.0', scanner: 'IZAKHONO-FORTRESS-SECURITY',
  startedAt: '2026-10-27T05:00:00.000Z', completedAt: '2026-10-27T05:01:00.000Z',
  scopeOwner: 'IZAKHONO', assetsScanned: 1, findings: [], evidenceDigest: 'abc123'
};

await store.putScan(report);
assert.deepEqual(await store.getLatestScan(), report);
assert.equal((await store.listScans()).length, 1);
assert.equal(storeKey(report).length, 64);
await fs.rm(root, { recursive: true, force: true });
console.log('FORTRESS persistence test: PASS');
