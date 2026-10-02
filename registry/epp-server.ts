import { createDomain, normalizeDomain, RegistryStore } from './core';
import { parseEpp, eppGreeting, eppResult } from './epp';

export type EppContext={registrarId:string;registrantId:string};

export async function eppHandle(store: RegistryStore, xml: string, context:EppContext={registrarId:'local-test-registrar',registrantId:'local-test-contact'}) {
  try {
    const parsed = parseEpp(xml);
    const name = normalizeDomain(parsed.domain);
    if (parsed.command === 'check') {
      const exists = !!(await store.getDomain(name));
      return eppResult(1000, exists ? 'domain exists' : 'domain available');
    }
    if (parsed.command === 'create') {
      if (await store.getDomain(name)) return eppResult(2302, 'domain exists');
      const domain = await createDomain(store, {
        name,
        registrarId: context.registrarId,
        registrantId: context.registrantId,
        nameservers: [],
        expiresAt: new Date(Date.now() + 365 * 86400000).toISOString()
      }, 'epp');
      return eppResult(1000, 'domain ' + domain.name + ' created');
    }
    return eppResult(2004, 'command not supported by test transport');
  } catch (error) {
    return eppResult(2001, error instanceof Error ? error.message : 'command syntax error');
  }
}

export const greeting = eppGreeting('IZAKHONO-REGISTRY-TEST');
