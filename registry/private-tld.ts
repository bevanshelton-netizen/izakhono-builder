import { MemoryRegistryStore } from './memory-store';
import { createDomain, Domain } from './core';

export const PRIVATE_TLD = 'izt';

export function isPrivateTld(name: string) {
  return name.toLowerCase().endsWith('.' + PRIVATE_TLD);
}

export async function provisionPrivateDomain(store: MemoryRegistryStore, input: Omit<Domain, 'status'|'createdAt'|'updatedAt'>) {
  if (!isPrivateTld(input.name)) throw new Error('private namespace is .izt');
  return createDomain(store, input, 'private-tld-test');
}
