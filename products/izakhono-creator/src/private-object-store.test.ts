import { createHash } from 'node:crypto';
import { createPrivateObjectStore, type PrivateObjectClient } from './private-object-store';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
async function rejects(action: () => Promise<unknown>, message: string) {
  let failed = false;
  try { await action(); } catch { failed = true; }
  assert(failed, message);
}
async function run() {
  const objects = new Map<string, { body: Uint8Array; contentType: string; metadata: Record<string, string> }>();
  const calls: string[] = [];
  const client: PrivateObjectClient = {
    async putObject(input) {
      calls.push('put');
      assert(input.ifNoneMatch === '*', 'uploads must be create-only');
      assert(!('acl' in input), 'adapter must not expose public ACLs');
      const id = input.bucket + '/' + input.key;
      if (objects.has(id)) throw new Error('precondition failed');
      objects.set(id, { body: new Uint8Array(input.body), contentType: input.contentType, metadata: input.metadata });
    },
    async getObject(input) {
      const item = objects.get(input.bucket + '/' + input.key);
      return item ? { body: new Uint8Array(item.body), contentType: item.contentType, metadata: { ...item.metadata } } : null;
    },
    async deleteObject(input) { objects.delete(input.bucket + '/' + input.key); },
  };
  const sha256 = async (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
  const store = createPrivateObjectStore({ bucket: 'creator-private', projectId: 'film-001', client, sha256, maxObjectBytes: 1024 });
  const bytes = new TextEncoder().encode('approved source media bytes');
  const hash = await sha256(bytes);
  const key = 'projects/film-001/source/source-001.bin';
  await store.put(key, bytes, { contentType: 'application/octet-stream', sha256: hash });
  const retrieved = await store.get(key);
  assert(retrieved?.sha256 === hash && new TextDecoder().decode(retrieved.bytes) === 'approved source media bytes', 'stored bytes must round-trip with verified hash');
  await rejects(() => store.put(key, bytes, { contentType: 'application/octet-stream', sha256: hash }), 'existing immutable objects must not be overwritten');
  await rejects(() => store.put('projects/other-film/source/a.bin', bytes, { contentType: 'application/octet-stream', sha256: hash }), 'cross-project keys must be rejected');
  await rejects(() => store.put('projects/film-001/../other/a.bin', bytes, { contentType: 'application/octet-stream', sha256: hash }), 'path traversal must be rejected');
  await rejects(() => store.put('projects/film-001/source/b.bin', bytes, { contentType: 'application/octet-stream', sha256: '0'.repeat(64) }), 'incorrect declared hashes must be rejected');
  objects.set('creator-private/' + key, { body: new TextEncoder().encode('tampered'), contentType: 'application/octet-stream', metadata: { sha256: hash, projectid: 'film-001' } });
  await rejects(() => store.get(key), 'tampered stored bytes must fail integrity verification');
  await store.delete(key);
  assert(await store.get(key) === null, 'deleted object must no longer be readable');
  console.log('Private object-store adapter tests passed.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
