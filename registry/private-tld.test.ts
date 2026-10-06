import { MemoryRegistryStore } from './memory-store';
import { provisionPrivateDomain } from './private-tld';

async function main(){
  const store = new MemoryRegistryStore();
  const domain = await provisionPrivateDomain(store, {
    name:'calvin.izt', registrarId:'izakhono-test', registrantId:'calvin-test', nameservers:[], expiresAt:new Date(Date.now()+86400000).toISOString()
  });
  if (domain.status !== 'pendingCreate') throw new Error('private TLD provisioning failed');
}

main().catch((error)=>{ console.error(error); process.exitCode=1; });
