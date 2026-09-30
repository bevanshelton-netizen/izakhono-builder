import { normalizeDomain, createDomain } from './core';
import { MemoryRegistryStore } from './memory-store';
import { rdapDomain } from './rdap';
import { eppHandle } from './epp-server';

const store = new MemoryRegistryStore();
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });

export async function registryFetch(request: Request) {
  const url = new URL(request.url);

  if (url.pathname === '/health')
    return json({ ok: true, service: 'IZAKHONO REGISTRY', mode: 'test-control-plane' });

  if (url.pathname === '/domain/check') {
    const name = url.searchParams.get('name');
    if (!name) return json({ ok: false, error: 'name required' }, 400);
    const normalized = normalizeDomain(name);
    return json({ name: normalized, available: !(await store.getDomain(normalized)) });
  }

  if (url.pathname === '/rdap/domain') {
    const name = url.searchParams.get('name');
    if (!name) return json({ ok: false, error: 'name required' }, 400);
    return json(await rdapDomain(store, normalizeDomain(name)));
  }

  if (url.pathname === '/domain/create' && request.method === 'POST') {
    const body = await request.json() as { name?: string; registrarId?: string; registrantId?: string; nameservers?: string[] };
    if (!body.name || !body.registrarId || !body.registrantId)
      return json({ ok: false, error: 'name, registrarId and registrantId required' }, 400);
    try {
      const domain = await createDomain(store, {
        name: body.name,
        registrarId: body.registrarId,
        registrantId: body.registrantId,
        nameservers: body.nameservers || [],
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString()
      }, 'api');
      return json({ ok: true, domain }, 201);
    } catch (error) {
      return json({ ok: false, error: error instanceof Error ? error.message : 'create failed' }, 409);
    }
  }

  if (url.pathname === '/epp' && request.method === 'POST')
    return new Response(await eppHandle(store, await request.text()), { headers: { 'content-type': 'application/epp+xml; charset=utf-8' } });

  return json({ ok: false, error: 'not found' }, 404);
}
