import {strict as assert} from 'node:assert';
import {verifyFortressCapabilityGrant} from './fortress-capabilities';
import {issueFortressGrant} from './fortress-grant-store';

const secret='test-only-fortress-capability-secret';
const b64=(bytes:Uint8Array)=>{let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');};
async function grant(overrides:Record<string,unknown>={}){
 const claims={iss:'IZAKHONO-FORTRESS',sub:'portfolio-orchestrator',aud:'IZAKHONO-WORKER-SUPERVISOR',actions:['execute'],risk:'low',iat:1000,nbf:1000,exp:1600,jti:'fortress-test-grant-0001',...overrides};
 const payload=b64(new TextEncoder().encode(JSON.stringify(claims)));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
 return payload+'.'+b64(signature);
}
const issued=await issueFortressGrant({workerId:'portfolio-orchestrator',risk:'low',actions:['execute'],issuer:'test-issuer',secret,ttlSeconds:120,nowSeconds:1200});
assert.equal((await verifyFortressCapabilityGrant(issued.token,'portfolio-orchestrator','low',secret,1250)).ok,true,'issuer must create verifiable scoped grants');
assert.equal(issued.claims.exp-issued.claims.iat,120,'issuer must honor bounded TTL');
const valid=await grant();
assert.equal((await verifyFortressCapabilityGrant(valid,'portfolio-orchestrator','low',secret,1200)).ok,true);
assert.equal((await verifyFortressCapabilityGrant(valid,'task-dispatcher','low',secret,1200)).ok,false,'grant must be worker-bound');
assert.equal((await verifyFortressCapabilityGrant(valid,'portfolio-orchestrator','high',secret,1200)).ok,false,'grant must be risk-bound');
assert.equal((await verifyFortressCapabilityGrant(valid,'portfolio-orchestrator','low',undefined,1200)).ok,false,'missing verifier secret must fail closed');
assert.equal((await verifyFortressCapabilityGrant(await grant({exp:2000}),'portfolio-orchestrator','low',secret,1200)).ok,false,'grant lifetime cannot exceed 15 minutes');
assert.equal((await verifyFortressCapabilityGrant(await grant({actions:['read']}),'portfolio-orchestrator','low',secret,1200)).ok,false,'execute action must be explicit');
assert.equal((await verifyFortressCapabilityGrant(valid+'.tamper','portfolio-orchestrator','low',secret,1200)).ok,false,'malformed token must fail closed');
console.log('FORTRESS capability contract tests: ok');
