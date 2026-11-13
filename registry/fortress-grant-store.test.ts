import {strict as assert} from 'node:assert';
import type {D1Database,D1Statement} from './d1-store';
import {ensureFortressGrantSchema,registerFortressGrant,consumeFortressGrant,revokeFortressGrant,issueFortressGrant} from './fortress-grant-store';

type GrantRow={jti:string;worker_id:string;risk:string;issuer:string;issued_at:string;expires_at:string;revoked_at:string|null;consumed_at:string|null;token_digest:string};
class FakeD1 implements D1Database{
 grants=new Map<string,GrantRow>();
 prepare(sql:string):D1Statement{
  const db=this;let values:unknown[]=[];
  const stmt={
   bind(...v:unknown[]){values=v;return stmt as unknown as D1Statement;},
   async run(){
    if(sql.includes('INSERT INTO fortress_capability_grants')){const [jti,worker_id,risk,issuer,issued_at,expires_at,token_digest]=values as string[];if(db.grants.has(jti))throw new Error('unique constraint');db.grants.set(jti,{jti,worker_id,risk,issuer,issued_at,expires_at,revoked_at:null,consumed_at:null,token_digest});return {meta:{changes:1}};}
    if(sql.includes('UPDATE fortress_capability_grants SET consumed_at')){const [at,jti,worker,expiry,digest]=values as string[];const row=db.grants.get(jti);if(!row||row.worker_id!==worker||row.revoked_at||row.consumed_at||row.expires_at<=expiry||row.token_digest!==digest)return {meta:{changes:0}};row.consumed_at=at;return {meta:{changes:1}};}
    if(sql.includes('UPDATE fortress_capability_grants SET revoked_at')){const [at,jti]=values as string[];const row=db.grants.get(jti);if(!row||row.revoked_at)return {meta:{changes:0}};row.revoked_at=at;return {meta:{changes:1}};}
    return {meta:{changes:0}};
   },
   async first<T>(){return null as T|null;},
   async all<T>(){return {results:[] as T[]};}
  };
  return stmt as unknown as D1Statement;
 }
}
const db=new FakeD1();
await ensureFortressGrantSchema(db);
const secret='test-only-fortress-capability-secret';
const issued=await issueFortressGrant({workerId:'portfolio-orchestrator',risk:'low',actions:['execute'],issuer:'unit-test-issuer',secret,ttlSeconds:120,nowSeconds:1200});
const digest='sha256-test-token-digest';
await registerFortressGrant(db,issued.claims,'unit-test-issuer',digest);
assert.equal(db.grants.size,1);
await assert.rejects(()=>consumeFortressGrant(db,issued.claims.jti,'portfolio-orchestrator','wrong-token-digest','1970-01-01T00:20:30.000Z'),/unknown, revoked, expired, or already consumed/,'a grant must be bound to the exact signed token digest');
await consumeFortressGrant(db,issued.claims.jti,'portfolio-orchestrator',digest,'1970-01-01T00:20:30.000Z');
await assert.rejects(()=>consumeFortressGrant(db,issued.claims.jti,'portfolio-orchestrator',digest,'1970-01-01T00:20:31.000Z'),/unknown, revoked, expired, or already consumed/,'a grant must be consumed once only');
const second=await issueFortressGrant({workerId:'portfolio-orchestrator',risk:'low',actions:['execute'],issuer:'unit-test-issuer',secret,ttlSeconds:120,nowSeconds:1200});
await registerFortressGrant(db,second.claims,'unit-test-issuer','second-token-digest');
await revokeFortressGrant(db,second.claims.jti,'unit-test-issuer','1970-01-01T00:20:30.000Z');
await assert.rejects(()=>consumeFortressGrant(db,second.claims.jti,'portfolio-orchestrator','second-token-digest','1970-01-01T00:20:31.000Z'),/unknown, revoked, expired, or already consumed/,'revoked grants cannot be consumed');
await assert.rejects(()=>consumeFortressGrant(db,'missing-jti','portfolio-orchestrator','x'),/unknown, revoked, expired, or already consumed/);
console.log('FORTRESS grant ledger contract tests: ok (single-use, digest binding, revocation)');
