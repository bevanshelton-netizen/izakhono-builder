import assert from 'node:assert/strict';
import test from 'node:test';
import { injectDatabaseId, resolveDatabaseId } from '../scripts/resolve-d1-binding.mjs';

const databaseId = '11111111-2222-4333-8444-555555555555';

test('resolves the exact database from Wrangler list output', () => {
  assert.equal(resolveDatabaseId([
    { name: 'another-database', uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
    { name: 'izakhono-pay', uuid: databaseId },
  ], 'izakhono-pay'), databaseId);
});

test('resolves wrapped Cloudflare list output', () => {
  assert.equal(resolveDatabaseId({ result: [{ name: 'izakhono-pay', uuid: databaseId }] }, 'izakhono-pay'), databaseId);
});

test('does not match a similarly named database', () => {
  assert.throws(() => resolveDatabaseId([
    { name: 'izakhono-pay-sandbox', uuid: databaseId },
  ], 'izakhono-pay'), /D1_DATABASE_NOT_FOUND/);
});

test('fails closed when the database is absent or ambiguous', () => {
  assert.throws(() => resolveDatabaseId([], 'izakhono-pay'), /D1_DATABASE_NOT_FOUND/);
  assert.throws(() => resolveDatabaseId([
    { name: 'izakhono-pay', uuid: databaseId },
    { name: 'izakhono-pay', uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
  ], 'izakhono-pay'), /D1_DATABASE_NAME_AMBIGUOUS/);
});

test('injects the resolved id into only the matching D1 binding', () => {
  const config = [
    '{',
    '  "d1_databases": [',
    '    {',
    '      "binding": "DB",',
    '      "database_name": "izakhono-pay",',
    '      "migrations_dir": "migrations"',
    '    }',
    '  ]',
    '}',
  ].join('\n');
  const resolved = injectDatabaseId(config, {
    databaseName: 'izakhono-pay',
    binding: 'DB',
    databaseId,
  });
  assert.match(resolved, new RegExp('"database_id": "' + databaseId + '"'));
  assert.match(resolved, /"migrations_dir": "migrations"/);
  assert.equal((resolved.match(/"database_id"/g) || []).length, 1);
});

test('refuses to silently replace a different pinned database id', () => {
  const config = [
    '{',
    '  "d1_databases": [',
    '    {',
    '      "binding": "DB",',
    '      "database_name": "izakhono-pay",',
    '      "database_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",',
    '      "migrations_dir": "migrations"',
    '    }',
    '  ]',
    '}',
  ].join('\n');
  assert.throws(() => injectDatabaseId(config, {
    databaseName: 'izakhono-pay',
    binding: 'DB',
    databaseId,
  }), /D1_CONFIG_ID_MISMATCH/);
});


test('replaces the explicit fail-closed placeholder with the verified D1 id', () => {
  const config = [
    '{',
    '  "d1_databases": [',
    '    {',
    '      "binding": "DB",',
    '      "database_name": "izakhono-pay",',
    '      "database_id": "00000000-0000-0000-0000-000000000000",',
    '      "migrations_dir": "migrations"',
    '    }',
    '  ]',
    '}',
  ].join('\n');
  const resolved = injectDatabaseId(config, {
    databaseName: 'izakhono-pay',
    binding: 'DB',
    databaseId,
  });
  assert.match(resolved, new RegExp('"database_id": "' + databaseId + '"'));
  assert.doesNotMatch(resolved, /00000000-0000-0000-0000-000000000000/);
});
