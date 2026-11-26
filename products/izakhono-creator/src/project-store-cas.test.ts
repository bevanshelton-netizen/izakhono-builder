import assert from 'node:assert/strict';
import { saveProjectIfUnchanged, type CreatorD1Database, type CreatorD1PreparedStatement } from './project-store';

const currentUpdatedAt = '2026-11-26T09:00:00.000Z';
let storedUpdatedAt = currentUpdatedAt;
let storedId = 'film-1';
let updateAttempts = 0;

const db: CreatorD1Database = {
  async batch() { return undefined; },
  prepare(query: string): CreatorD1PreparedStatement {
    return {
      bind(...values: unknown[]) {
        return {
          async run() { return undefined; },
          async all<T>() { return { results: [] as T[] }; },
          async first<T>() {
            if (query.includes('UPDATE creator_projects')) {
              updateAttempts += 1;
              const [brief, packageJson, nextUpdatedAt, id, expectedUpdatedAt] = values;
              assert.equal(typeof brief, 'string');
              assert.equal(typeof packageJson, 'string');
              assert.equal(id, storedId);
              if (expectedUpdatedAt !== storedUpdatedAt) return null;
              storedUpdatedAt = String(nextUpdatedAt);
              return { id: storedId } as T;
            }
            return null;
          },
        };
      },
    };
  },
};

const saved = await saveProjectIfUnchanged(db ? { DB: db } : {}, {
  id: 'film-1', brief: 'Updated brief', packageData: { cinematicProduction: { metadata: { version: 2 } } },
}, currentUpdatedAt);
assert.equal(saved, true);
assert.equal(updateAttempts, 1);

const stale = await saveProjectIfUnchanged({ DB: db }, {
  id: 'film-1', brief: 'Stale update', packageData: {},
}, currentUpdatedAt);
assert.equal(stale, false);
assert.equal(updateAttempts, 2);

await assert.rejects(
  () => saveProjectIfUnchanged({}, { id: 'film-1', brief: 'x', packageData: {} }, storedUpdatedAt),
  /D1 storage is required/,
);
await assert.rejects(
  () => saveProjectIfUnchanged({ DB: db }, { id: ' ', brief: 'x', packageData: {} }, storedUpdatedAt),
  /Project ID and expected update timestamp are required/,
);
console.log('Creator project optimistic compare-and-swap persistence: PASS');
