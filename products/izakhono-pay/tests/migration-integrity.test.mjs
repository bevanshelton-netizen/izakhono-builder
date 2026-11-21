import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const migrationsDir = new URL('../migrations/', import.meta.url);

test('every table referenced by API-key issuance exists before its index migration', async () => {
  const files = (await readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();
  const beforeIndex = files.filter((name) => name < '0017_izakhono_pay_api_key_issuance.sql');
  const sql = (await Promise.all(beforeIndex.map((name) => readFile(new URL(name, migrationsDir), 'utf8')))).join('\n');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS pay_api_keys\s*\(/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS pay_auth_events\s*\(/);
  assert.ok(files.includes('0016_pay_api_keys_and_auth_events.sql'));
});
