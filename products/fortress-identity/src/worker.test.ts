import assert from 'node:assert/strict';
import { handleFortressIdentity } from './worker';

const unusedDb = { prepare(){ throw new Error('Database must not be touched by these boundary tests'); }, batch(){ throw new Error('Database must not be touched by these boundary tests'); } } as any;
async function run(){
  const env={DB:unusedDb,FORTRESS_SESSION_HMAC_SECRET:'0123456789abcdef0123456789abcdef'};
  const health=await handleFortressIdentity(new Request('https://creator.example/api/fortress/health'),env);
  assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{service:'FORTRESS Identity',status:'ready'});
  const unknown=await handleFortressIdentity(new Request('https://creator.example/api/fortress/not-a-route'),env);
  assert.equal(unknown.status,404);
  const noBootstrap=await handleFortressIdentity(new Request('https://creator.example/api/fortress/bootstrap',{method:'POST',headers:{'content-type':'application/json','x-fortress-bootstrap-secret':'not-a-secret'},body:JSON.stringify({})}),env);
  assert.equal(noBootstrap.status,403,'owner bootstrap fails closed without the out-of-band secret');
  const noOrigin=await handleFortressIdentity(new Request('https://creator.example/api/fortress/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'owner@example.com',password:'not-a-real-password'})}),env);
  assert.equal(noOrigin.status,403,'login rejects missing/untrusted Origin before database access');
  const noCsrf=await handleFortressIdentity(new Request('https://creator.example/api/fortress/logout',{method:'POST',headers:{origin:'https://creator.example'}}),{...env,FORTRESS_ALLOWED_ORIGINS:'https://creator.example'});
  assert.equal(noCsrf.status,403,'logout requires origin and CSRF validation');
  console.log('FORTRESS Identity boundary tests: PASS');
}
run().catch(error=>{console.error(error);process.exitCode=1});
