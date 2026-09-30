import { MemoryRegistryStore } from './memory-store';
import { eppHandle, greeting } from './epp-server';

const store = new MemoryRegistryStore();
if (!greeting.includes('IZAKHONO-REGISTRY-TEST')) throw new Error('missing greeting');

const check = await eppHandle(store, '<epp><command><check><domain:check><domain:name>alpha.izt</domain:name></domain:check></check></command></epp>');
if (!check.includes('domain available')) throw new Error('check failed');

const create = await eppHandle(store, '<epp><command><create><domain:create><domain:name>alpha.izt</domain:name></domain:create></create></command></epp>');
if (!create.includes('created')) throw new Error('create failed');

const duplicate = await eppHandle(store, '<epp><command><create><domain:create><domain:name>alpha.izt</domain:name></domain:create></create></command></epp>');
if (!duplicate.includes('domain exists')) throw new Error('duplicate protection failed');
