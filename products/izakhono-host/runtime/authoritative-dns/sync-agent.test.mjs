import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { renderZone, syncOnce, validateSnapshot } from './sync-agent.mjs';

const sample = {
  ok: true, schema_version: 1,
  zones: [{
    zone_name: 'example.com', serial: 2026111301,
    records: [
      { name: 'example.com', type: 'SOA', ttl: 300, value: 'ns1.dns.example.net. hostmaster.example.com. 2026111301 3600 600 1209600 300', enabled: 1 },
      { name: 'example.com', type: 'NS', ttl: 300, value: 'ns1.dns.example.net.', enabled: 1 },
      { name: 'www.example.com', type: 'A', ttl: 300, value: '192.0.2.10', enabled: 1 },
      { name: 'mail.example.com', type: 'MX', ttl: 300, priority: 10, value: 'mail.example.net.', enabled: 1 },
      { name: 'example.com', type: 'TXT', ttl: 300, value: 'v=spf1 -all', enabled: 1 }
    ]
  }]
};

test('validates and renders a CoreDNS zone file', () => {
  assert.equal(validateSnapshot(sample).length, 1);
  const text = renderZone(sample.zones[0]);
  assert.match(text, /\\$ORIGIN example\\.com\\./);
  assert.match(text, /www\\. 300 IN A 192\\.0\\.2\\.10/);
  assert.match(text, /@ 300 IN MX 10 mail\\.example\\.net\\./);
  assert.match(text, /2026111301/);
});

test('rejects invalid IPv4 values', () => {
  const bad = structuredClone(sample);
  bad.zones[0].records.find(r => r.type === 'A').value = '192.0.2.999';
  assert.throws(() => validateSnapshot(bad), /IPv4/);
});

test('rejects records outside their zone', () => {
  const bad = structuredClone(sample);
  bad.zones[0].records.find(r => r.type === 'A').name = 'attacker.invalid';
  assert.throws(() => validateSnapshot(bad), /outside the zone/);
});

test('rejects a snapshot without one matching SOA', () => {
  const bad = structuredClone(sample);
  bad.zones[0].records = bad.zones[0].records.filter(r => r.type !== 'SOA');
  assert.throws(() => validateSnapshot(bad), /exactly one SOA/);
});

test('syncs files atomically and removes only previously managed stale files', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'izakhono-dns-'));
  try {
    await syncOnce({
      url: 'https://host.internal/internal/dns/snapshot', token: 'secret', directory: dir,
      fetchImpl: async (_url, options) => {
        assert.equal(options.headers.authorization, 'Bearer secret');
        return { ok: true, json: async () => sample };
      }
    });
    const zone = await readFile(path.join(dir, 'izakhono-example_com.zone'), 'utf8');
    assert.match(zone, /www\\. 300 IN A 192\\.0\\.2\\.10/);
    const empty = { ...sample, zones: [] };
    await syncOnce({
      url: 'https://host.internal/internal/dns/snapshot', token: 'secret', directory: dir,
      fetchImpl: async () => ({ ok: true, json: async () => empty })
    });
    await assert.rejects(readFile(path.join(dir, 'izakhono-example_com.zone'), 'utf8'), { code: 'ENOENT' });
  } finally { await rm(dir, { recursive: true, force: true }); }
});
