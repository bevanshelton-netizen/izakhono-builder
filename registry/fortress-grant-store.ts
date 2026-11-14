import type {D1Database} from './d1-store';
import type {FortressCapabilityClaims} from './fortress-capabilities';

const encode=(bytes:Uint8Array)=>{let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);return btoa(binary).replace(/=/g,'').replace(/[+]/g,'-').replace(/[/]/g,'_');};
export async function issueFortressGrant(input:{workerId:string;risk:'low'|'medium'|'high';actions:string[];issuer:string;secret?:string;ttlSeconds?:number;nowSeconds?:number}){
 if(!input.secret)throw new Error('FORTRESS signing secret is not configured');
 if(!input.issuer.trim())throw new Error('grant issuer identity is required');
 if(!input.actions.length||input.actions.some(a=>a!=='execute'))throw new Error('only explicit execute capability may be issued by this endpoint');
 const now=input.nowSeconds??Math.floor(Date.now()/1000);const ttl=Math.min(Math.max(input.ttlSeconds??300,60),900);
 const claims:FortressCapabilityClaims={iss:'IZAKHONO-FORTRESS',sub:input.workerId,aud:'IZAKHONO-WORKER-SUPERVISOR',actions:[...new Set(input.actions)],risk:input.risk,iat:now,nbf:now,exp:now+ttl,jti:crypto.randomUUID()};
 const payload=encode(new TextEncoder().encode(JSON.stringify(claims)));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(input.secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));
 return {token:payload+'.'+encode(signature),claims};
}
export async function ensureFortressGrantSchema(db:D1Database){
 await db.prepare(`CREATE TABLE IF NOT EXISTS fortress_capability_grants (
 jti TEXT PRIMARY KEY, worker_id TEXT NOT NULL, risk TEXT NOT NULL, issuer TEXT NOT NULL,
 issued_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT, consumed_at TEXT,
 token_digest TEXT NOT NULL
 )`).run();
 await db.prepare('CREATE INDEX IF NOT EXISTS idx_fortress_grants_worker_expiry ON fortress_capability_grants(worker_id,expires_at)').run();
 await db.prepare(`CREATE TRIGGER IF NOT EXISTS fortress_grant_revocation_audit AFTER UPDATE OF revoked_at ON fortress_capability_grants WHEN OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL BEGIN INSERT INTO supervisor_job_events(id,job_id,at,from_status,to_status,actor,detail_json) VALUES(lower(hex(randomblob(16))),'fortress-grant:'||NEW.jti,NEW.revoked_at,'issued','revoked',NEW.issuer,json_object('jti',NEW.jti)); END`).run();
}
export async function registerFortressGrant(db:D1Database,claims:FortressCapabilityClaims,issuer:string,tokenDigest:string){
 await db.prepare('INSERT INTO fortress_capability_grants(jti,worker_id,risk,issuer,issued_at,expires_at,token_digest) VALUES(?,?,?,?,?,?,?)')
 .bind(claims.jti,claims.sub,claims.risk,issuer,new Date(claims.iat*1000).toISOString(),new Date(claims.exp*1000).toISOString(),tokenDigest).run();
}
export async function consumeFortressGrant(db:D1Database,jti:string,workerId:string,tokenDigest:string,now=new Date().toISOString()){
 const result=await db.prepare('UPDATE fortress_capability_grants SET consumed_at=? WHERE jti=? AND worker_id=? AND revoked_at IS NULL AND consumed_at IS NULL AND expires_at>? AND token_digest=?').bind(now,jti,workerId,now,tokenDigest).run() as {meta?:{changes?:number}};
 if(Number(result.meta?.changes??0)!==1)throw new Error('FORTRESS grant is unknown, revoked, expired, or already consumed');
 return {jti,consumedAt:now};
}
export async function revokeFortressGrant(db:D1Database,jti:string,issuer:string,now=new Date().toISOString()){
 const result=await db.prepare('UPDATE fortress_capability_grants SET revoked_at=? WHERE jti=? AND revoked_at IS NULL').bind(now,jti).run() as {meta?:{changes?:number}};
 if(Number(result.meta?.changes??0)!==1)throw new Error('grant not found or already revoked');
 return {jti,revokedAt:now};
}
