import { createDomain, normalizeDomain, RegistryStore } from './core';
import { parseEpp, eppGreeting, eppResult } from './epp';

export async function eppHandle(store: RegistryStore, xml: string) {
  const parsed = parseEpp(xml);
  if (!parsed) return eppResult(2001, 'command syntax error');
  if (parsed.command === 'check') {
    const name = normalizeDomain(parsed.name);
    const exists = !!(await store.getDomain(name));
    return eppResult(1000, exists ? 'domain exists' : 'domain available');
  }
  if (parsed.command === 'create') {
    const domain = await createDomain(store, {
      name: parsed.name,
      registrarId: parsed.registrarId || 'local-test-registrar',
      registrantId: parsed.registrantId || 'local-test-contact',
      nameservers: parsed.nameservers || [],
      expiresAt: parsed.expiresAt || new Date(Date.now() + 365 * 86400000).toISOString()
    }, 'epp');
    return eppResult(1000, 'domain ' + domain.name + ' created');
  }
  return eppResult(2004, 'command not supported by test transport');
}

export const greeting = eppGreeting();
