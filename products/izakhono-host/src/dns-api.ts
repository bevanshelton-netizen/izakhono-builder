import { normalizeZoneName, validateDnsRecord, type DnsRecordType } from './dns';

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}
interface D1 { prepare(sql: string): D1Statement; }
interface DnsEnv { DB: D1; }

const TYPES = new Set<DnsRecordType>(['A','AAAA','CNAME','MX','TXT','SRV','CAA']);
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
});
const id = (prefix: string) => prefix + '_' + crypto.randomUUID().replaceAll('-', '');
const text = (value: unknown, max = 500) => typeof value === 'string' ? value.trim().slice(0, max) : '';

function validateNameserver(value: string): string {
  const name = value.toLowerCase().replace(/\.$/, '');
  if (!/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(name)) {
    throw new Error('A fully-qualified nameserver hostname is required');
  }
  return name;
}

async function audit(env: DnsEnv, customerId: string, zoneId: string, action: string, details: unknown) {
  await env.DB.prepare(
    'INSERT INTO dns_audit_events(id,zone_id,action,actor,details_json,created_at) VALUES(?,?,?,?,?,CURRENT_TIMESTAMP)'
  ).bind(id('dns_evt'), zoneId, action, 'owner-api', JSON.stringify(details).slice(0, 8000)).run();
}

async function ownedZone(env: DnsEnv, zoneId: string, customerId: string) {
  return env.DB.prepare('SELECT * FROM dns_zones WHERE id=? AND customer_id=?')
    .bind(zoneId, customerId).first<any>();
}

async function bumpSerial(env: DnsEnv, zoneId: string, customerId: string): Promise<number> {
  const base = Number(new Date().toISOString().slice(0, 10).replaceAll('-', '') + '01');
  const updated = await env.DB.prepare(
    'UPDATE dns_zones SET serial=CASE WHEN serial>=? THEN serial+1 ELSE ? END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND customer_id=? RETURNING serial'
  ).bind(base, base, zoneId, customerId).first<{ serial: number }>();
  if (!updated) throw new Error('Zone serial update failed');
  return Number(updated.serial);
}

/**
 * Owner-authenticated DNS control API. It mutates only HOST's canonical D1
 * control-plane state. It never writes to public authoritative servers.
 */
export async function handleDnsApi(req: Request, env: DnsEnv, url: URL): Promise<Response | null> {
  if (!url.pathname.startsWith('/api/dns/')) return null;

  if (url.pathname === '/api/dns/zones' && req.method === 'GET') {
    const customerId = text(url.searchParams.get('customer_id'), 100);
    if (!customerId) return json({ ok: false, error: 'customer_id is required' }, 400);
    const rows = await env.DB.prepare(
      'SELECT * FROM dns_zones WHERE customer_id=? ORDER BY zone_name ASC'
    ).bind(customerId).all<any>();
    return json({ ok: true, zones: rows.results || [], publication: 'not-published' });
  }

  if (url.pathname === '/api/dns/zones' && req.method === 'POST') {
    let b: any;
    try { b = await req.json(); } catch { return json({ ok: false, error: 'Expected JSON body' }, 400); }
    const customerId = text(b.customer_id, 100);
    if (!customerId) return json({ ok: false, error: 'customer_id is required' }, 400);
    let zoneName: string, primary: string, secondary: string;
    try {
      zoneName = normalizeZoneName(text(b.zone_name, 253));
      primary = validateNameserver(text(b.primary_nameserver, 253));
      secondary = validateNameserver(text(b.secondary_nameserver, 253));
      if (primary === secondary) throw new Error('Primary and secondary nameservers must differ');
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : 'Invalid zone input' }, 400);
    }
    const customer = await env.DB.prepare('SELECT id FROM host_customers WHERE id=?')
      .bind(customerId).first<any>();
    if (!customer) return json({ ok: false, error: 'Customer not found' }, 404);
    const zoneId = id('zone');
    try {
      await env.DB.prepare(
        'INSERT INTO dns_zones(id,customer_id,zone_name,status,serial,primary_nameserver,secondary_nameserver,created_at,updated_at) VALUES(?,?,?,\'planned\',1,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)'
      ).bind(zoneId, customerId, zoneName, primary, secondary).run();
      await audit(env, customerId, zoneId, 'zone.created', { zone_name: zoneName, status: 'planned' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Zone creation failed';
      return json({ ok: false, error: message.includes('UNIQUE') ? 'Zone already exists' : message }, 409);
    }
    const zone = await ownedZone(env, zoneId, customerId);
    return json({ ok: true, zone, publication: 'not-published', next_gate: 'authoritative adapter and dual-node acceptance' }, 201);
  }

  const recordsMatch = url.pathname.match(/^\/api\/dns\/zones\/([^/]+)\/records$/);
  if (recordsMatch) {
    const zoneId = decodeURIComponent(recordsMatch[1]);
    const customerId = text(url.searchParams.get('customer_id') || (req.method === 'POST' ? '' : ''), 100);
    if (!customerId) {
      let b: any = {};
      if (req.method === 'POST') { try { b = await req.clone().json(); } catch {} }
      const supplied = text(b.customer_id, 100);
      if (!supplied) return json({ ok: false, error: 'customer_id is required' }, 400);
      return handleRecordRequest(req, env, zoneId, supplied);
    }
    return handleRecordRequest(req, env, zoneId, customerId);
  }

  const deleteMatch = url.pathname.match(/^\/api\/dns\/zones\/([^/]+)\/records\/([^/]+)$/);
  if (deleteMatch && req.method === 'DELETE') {
    const zoneId = decodeURIComponent(deleteMatch[1]);
    const recordId = decodeURIComponent(deleteMatch[2]);
    const customerId = text(url.searchParams.get('customer_id'), 100);
    if (!customerId) return json({ ok: false, error: 'customer_id is required' }, 400);
    const zone = await ownedZone(env, zoneId, customerId);
    if (!zone) return json({ ok: false, error: 'Zone not found for customer' }, 404);
    const record = await env.DB.prepare('SELECT * FROM dns_records WHERE id=? AND zone_id=?')
      .bind(recordId, zoneId).first<any>();
    if (!record) return json({ ok: false, error: 'Record not found' }, 404);
    await env.DB.prepare('DELETE FROM dns_records WHERE id=? AND zone_id=?').bind(recordId, zoneId).run();
    const serial = await bumpSerial(env, zoneId, customerId);
    await audit(env, customerId, zoneId, 'record.deleted', { record_id: recordId, serial });
    return json({ ok: true, deleted: recordId, serial, publication: 'not-published' });
  }

  return json({ ok: false, error: 'Unsupported DNS API route' }, 404);
}

async function handleRecordRequest(req: Request, env: DnsEnv, zoneId: string, customerId: string): Promise<Response> {
  const zone = await ownedZone(env, zoneId, customerId);
  if (!zone) return json({ ok: false, error: 'Zone not found for customer' }, 404);
  if (req.method === 'GET') {
    const rows = await env.DB.prepare('SELECT * FROM dns_records WHERE zone_id=? ORDER BY name,type')
      .bind(zoneId).all<any>();
    return json({ ok: true, zone_id: zoneId, records: rows.results || [], publication: 'not-published' });
  }
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405);
  let b: any;
  try { b = await req.json(); } catch { return json({ ok: false, error: 'Expected JSON body' }, 400); }
  const type = text(b.type, 8).toUpperCase() as DnsRecordType;
  const name = text(b.name, 253).toLowerCase();
  const value = text(b.value, 4096);
  const ttl = Number(b.ttl ?? 300);
  const priority = b.priority === undefined ? undefined : Number(b.priority);
  if (!TYPES.has(type)) return json({ ok: false, error: 'Record type is not supported by this API' }, 400);
  if (name !== '@' && !/^(?=.{1,253}$)([a-z0-9_*-](?:[a-z0-9_-]{0,61}[a-z0-9])?)(\.([a-z0-9_*-](?:[a-z0-9_-]{0,61}[a-z0-9])?))*$/.test(name)) {
    return json({ ok: false, error: 'Invalid relative record name' }, 400);
  }
  try { validateDnsRecord({ name, type, ttl, value, priority, enabled: true }); }
  catch (error) { return json({ ok: false, error: error instanceof Error ? error.message : 'Invalid DNS record' }, 400); }

  if (type === 'A' && !/^(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)){3}$/.test(value)) return json({ ok: false, error: 'A record requires a valid IPv4 address' }, 400);
  if (type === 'AAAA') { try { new URL('http://[' + value + ']/'); } catch { return json({ ok: false, error: 'AAAA record requires a valid IPv6 address' }, 400); } }

  const conflicts = await env.DB.prepare(
    'SELECT type FROM dns_records WHERE zone_id=? AND name=? AND enabled=1'
  ).bind(zoneId, name).all<any>();
  const existingTypes = (conflicts.results || []).map((row: any) => row.type);
  if (type === 'CNAME' && existingTypes.length) return json({ ok: false, error: 'CNAME cannot coexist with other records at the same name' }, 409);
  if (type !== 'CNAME' && existingTypes.includes('CNAME')) return json({ ok: false, error: 'A CNAME already exists at this name' }, 409);

  const recordId = id('rec');
  try {
    const serial = await bumpSerial(env, zoneId, customerId);
    await env.DB.prepare(
      'INSERT INTO dns_records(id,zone_id,name,type,ttl,priority,value,proxied,enabled,created_at,updated_at) VALUES(?,?,?,?,?,?,?,0,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)'
    ).bind(recordId, zoneId, name, type, ttl, priority ?? null, value).run();
    await audit(env, customerId, zoneId, 'record.created', { record_id: recordId, name, type, ttl, serial });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Record creation failed' }, 409);
  }
  return json({ ok: true, record: { id: recordId, zone_id: zoneId, name, type, ttl, priority: priority ?? null, value, enabled: true }, serial, publication: 'not-published' }, 201);
}
