export type PayAuthResult = { merchantId:string; keyId:string };

function bytesToHex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('')}

export async function sha256(value:string){
  return bytesToHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));
}

export function generatePayApiKey(){
  const raw=`izp_${crypto.randomUUID().replaceAll('-','')}${crypto.randomUUID().replaceAll('-','')}`;
  return {raw,prefix:raw.slice(0,12)};
}

export async function authenticateMerchant(req:Request,db:D1Database){
  const header=req.headers.get('authorization')||'';
  const token=header.startsWith('Bearer ')?header.slice(7).trim():'';
  if(!token)return null;
  const hash=await sha256(token);
  const row=await db.prepare('SELECT id,merchant_id FROM pay_api_keys WHERE key_hash=? AND status=\'active\'').bind(hash).first<any>();
  if(!row)return null;
  await db.prepare('UPDATE pay_api_keys SET last_used_at=? WHERE id=?').bind(new Date().toISOString(),row.id).run();
  return {merchantId:String(row.merchant_id),keyId:String(row.id)} as PayAuthResult;
}
