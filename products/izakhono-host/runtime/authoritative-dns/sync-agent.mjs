import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = new Set(['A', 'NS', 'CNAME', 'MX', 'TXT', 'SOA']);
const FQDN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function assert(condition, message) { if (!condition) throw new Error(message); }
function normalizeDomain(value) { return String(value || '').trim().replace(/\.$/, '').toLowerCase(); }
function validIPv4(value) {
  const parts = String(value).split('.');
  return parts.length === 4 && parts.every(p => /^\d{1,3}$/.test(p) && Number(p) <= 255);
}
function ownerLabel(name, zone) {
  const fqdn = normalizeDomain(name);
  assert((fqdn === zone || fqdn.endsWith('.' + zone)) && FQDN.test(fqdn), 'record owner is outside the zone or invalid');
  return fqdn === zone ? '@' : fqdn.slice(0, -(zone.length + 1)) + '.';
}
function quoteTxt(value) {
  const raw = String(value);
  assert(raw.length > 0 && raw.length <= 255 && !/[\r\n\0]/.test(raw), 'invalid TXT value length or characters');
  return '"' + raw.replace(/\\/g, '\\5c').replace(/"/g, '\\22') + '"';
}

export function validateSnapshot(snapshot) {
  assert(snapshot && snapshot.ok === true && snapshot.schema_version === 1 && Array.isArray(snapshot.zones), 'unsupported DNS snapshot');
  assert(snapshot.zones.length <= 1000, 'too many DNS zones');
  const seen = new Set();
  for (const zone of snapshot.zones) {
    const name = normalizeDomain(zone.zone_name);
    assert(FQDN.test(name) && !seen.has(name), 'invalid or duplicate zone');
    seen.add(name);
    assert(Number.isSafeInteger(Number(zone.serial)) && Number(zone.serial) > 0, 'invalid zone serial');
    assert(Array.isArray(zone.records), 'zone records missing');
    let soa = 0;
    for (const record of zone.records) {
      const type = String(record.type || '').toUpperCase();
      assert(TYPES.has(type), 'unsupported DNS record type: ' + type);
      assert(Number.isInteger(Number(record.ttl)) && Number(record.ttl) >= 30 && Number(record.ttl) <= 86400, 'invalid record TTL');
      if (type === 'SOA') {
        soa++;
        const fields = String(record.value || '').trim().split(/\s+/);
        assert(fields.length === 7 && FQDN.test(normalizeDomain(fields[0])) && FQDN.test(normalizeDomain(fields[1])), 'invalid SOA record');
        assert(Number(fields[2]) === Number(zone.serial), 'SOA serial does not match zone serial');
        for (const n of fields.slice(2)) assert(Number.isSafeInteger(Number(n)) && Number(n) >= 0 && Number(n) <= 4294967295, 'invalid SOA timer');
      } else {
        ownerLabel(record.name, name);
        if (type === 'A') assert(validIPv4(record.value), 'invalid IPv4 address');
        if (type === 'NS' || type === 'CNAME') assert(FQDN.test(normalizeDomain(record.value)), 'invalid nameserver/alias target');
        if (type === 'MX') {
          assert(Number.isInteger(Number(record.priority)) && Number(record.priority) >= 0 && Number(record.priority) <= 65535, 'invalid MX priority');
          assert(FQDN.test(normalizeDomain(record.value)), 'invalid MX target');
        }
        if (type === 'TXT') quoteTxt(record.value);
      }
    }
    assert(soa === 1, 'zone must contain exactly one SOA record');
  }
  return snapshot.zones;
}

export function renderZone(zone) {
  const name = normalizeDomain(zone.zone_name);
  const records = zone.records.filter(r => r.enabled !== false && Number(r.enabled ?? 1) !== 0);
  const soa = records.find(r => String(r.type).toUpperCase() === 'SOA');
  assert(soa, 'SOA record required');
  const fields = String(soa.value).trim().split(/\s+/);
  const lines = ['$ORIGIN ' + name + '.', '$TTL 300',
    '@ IN SOA ' + normalizeDomain(fields[0]) + '. ' + normalizeDomain(fields[1]) + '. ( ' +
    fields.slice(2).join(' ') + ' )'];
  for (const r of records) {
    const type = String(r.type).toUpperCase();
    if (type === 'SOA') continue;
    const owner = ownerLabel(r.name, name);
    const ttl = Number(r.ttl);
    if (type === 'A') lines.push(owner + ' ' + ttl + ' IN A ' + r.value);
    else if (type === 'NS' || type === 'CNAME') lines.push(owner + ' ' + ttl + ' IN ' + type + ' ' + normalizeDomain(r.value) + '.');
    else if (type === 'MX') lines.push(owner + ' ' + ttl + ' IN MX ' + Number(r.priority) + ' ' + normalizeDomain(r.value) + '.');
    else if (type === 'TXT') lines.push(owner + ' ' + ttl + ' IN TXT ' + quoteTxt(r.value));
  }
  return lines.join('\n') + '\n';
}

async function atomicWrite(file, content) {
  const temp = file + '.tmp-' + process.pid + '-' + Math.random().toString(16).slice(2);
  await fs.writeFile(temp, content, { encoding: 'utf8', mode: 0o640, flag: 'wx' });
  try { await fs.rename(temp, file); }
  catch (error) { await fs.rm(temp, { force: true }); throw error; }
}

export async function syncOnce({ url, token, directory, fetchImpl = fetch }) {
  assert(url && token && directory, 'DNS_SYNC_URL, DNS_SYNC_TOKEN and DNS_ZONE_DIR are required');
  const parsed = new URL(url);
  assert(parsed.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(parsed.hostname), 'DNS snapshot URL must use HTTPS');
  const response = await fetchImpl(parsed, { headers: { authorization: 'Bearer ' + token, accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  assert(response.ok, 'DNS snapshot request failed with HTTP ' + response.status);
  const zones = validateSnapshot(await response.json());
  await fs.mkdir(directory, { recursive: true, mode: 0o750 });
  const manifestPath = path.join(directory, '.izakhono-managed.json');
  let previous = [];
  try { previous = JSON.parse(await fs.readFile(manifestPath, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  assert(Array.isArray(previous), 'invalid managed-zone manifest');
  const current = [];
  for (const zone of zones) {
    const fileName = 'izakhono-' + normalizeDomain(zone.zone_name).replace(/\./g, '_') + '.zone';
    await atomicWrite(path.join(directory, fileName), renderZone(zone));
    current.push(fileName);
  }
  await atomicWrite(manifestPath, JSON.stringify(current.sort(), null, 2) + '\n');
  for (const old of previous) {
    if (typeof old === 'string' && /^izakhono-[a-z0-9_]+\.zone$/.test(old) && !current.includes(old)) {
      await fs.rm(path.join(directory, old), { force: true });
    }
  }
  return { zones: current.length, files: current };
}

async function main() {
  const interval = Math.max(15, Number(process.env.DNS_SYNC_INTERVAL_SECONDS || 30)) * 1000;
  const config = { url: process.env.DNS_SYNC_URL, token: process.env.DNS_SYNC_TOKEN, directory: process.env.DNS_ZONE_DIR || '/zones' };
  for (;;) {
    try { const result = await syncOnce(config); console.log(JSON.stringify({ event: 'dns_snapshot_applied', ...result })); }
    catch (error) { console.error(JSON.stringify({ event: 'dns_snapshot_failed', message: error.message })); }
    await sleep(interval);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
