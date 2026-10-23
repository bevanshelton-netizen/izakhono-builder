import { sha256 } from './auth';

export async function createSession(db:D1Database,merchantId:string){
  const raw=`ips_${crypto.randomUUID().replaceAll('-','')}${crypto.randomUUID().replaceAll('-','')}`;
  const hash=await sha256(raw);
  const now=new Date();
  const expires=new Date(now.getTime()+8*60*60*1000);
  const id=`ses_${crypto.randomUUID()}`;
  await db.prepare('INSERT INTO pay_sessions (id,merchant_id,session_hash,expires_at,created_at,last_used_at) VALUES (?,?,?,?,?,?)')
    .bind(id,merchantId,hash,expires.toISOString(),now.toISOString(),now.toISOString()).run();
  return {id,raw,expiresAt:expires.toISOString()};
}

export async function authenticateSession(db:D1Database,raw:string){
  if(!raw)return null;
  const hash=await sha256(raw);
  const row=await db.prepare('SELECT id,merchant_id,expires_at FROM pay_sessions WHERE session_hash=? AND revoked_at IS NULL').bind(hash).first<any>();
  if(!row)return null;
  if(new Date(String(row.expires_at)).getTime()<=Date.now())return null;
  await db.prepare('UPDATE pay_sessions SET last_used_at=? WHERE id=?').bind(new Date().toISOString(),row.id).run();
  return {sessionId:String(row.id),merchantId:String(row.merchant_id)};
}

export function sessionCookie(token:string){return `izakhono_pay_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=28800`}
export function clearSessionCookie(){return 'izakhono_pay_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}
export function readSessionCookie(req:Request){
  const raw=req.headers.get('cookie')||'';
  const match=raw.split(';').map(x=>x.trim()).find(x=>x.startsWith('izakhono_pay_session='));
  return match?match.slice('izakhono_pay_session='.length):'';
}
