import { generatePayApiKey, sha256 } from './auth';

const auditId=()=>`aud_${crypto.randomUUID()}`;
const now=()=>new Date().toISOString();

export async function issueMerchantApiKey(db:D1Database,merchantId:string,label='Primary API key'){
  const merchant=await db.prepare('SELECT id FROM pay_merchants WHERE id=?').bind(merchantId).first<any>();
  if(!merchant)return null;
  const key=generatePayApiKey();
  const keyId=`key_${crypto.randomUUID()}`;
  const hash=await sha256(key.raw);
  await db.prepare('INSERT INTO pay_api_keys (id,merchant_id,key_prefix,key_hash,label,status,created_at) VALUES (?,?,?,?,?,?,?)')
    .bind(keyId,merchantId,key.prefix,hash,label,'active',now()).run();
  await db.prepare('INSERT INTO pay_auth_events (id,merchant_id,key_id,event_type,created_at,metadata_json) VALUES (?,?,?,?,?,?)')
    .bind(auditId(),merchantId,keyId,'api_key.issued',now(),JSON.stringify({label,key_prefix:key.prefix})).run();
  return {id:keyId,prefix:key.prefix,key:key.raw,label,status:'active'};
}

export async function revokeMerchantApiKey(db:D1Database,merchantId:string,keyId:string){
  const result=await db.prepare("UPDATE pay_api_keys SET status='revoked',revoked_at=? WHERE id=? AND merchant_id=? AND status='active'")
    .bind(now(),keyId,merchantId).run();
  const changed=Number(result.meta?.changes||0)>0;
  if(changed){
    await db.prepare('INSERT INTO pay_auth_events (id,merchant_id,key_id,event_type,created_at,metadata_json) VALUES (?,?,?,?,?,?)')
      .bind(auditId(),merchantId,keyId,'api_key.revoked',now(),JSON.stringify({})).run();
  }
  return changed;
}

export async function listMerchantApiKeys(db:D1Database,merchantId:string){
  const rows=await db.prepare('SELECT id,key_prefix,label,status,last_used_at,created_at,revoked_at FROM pay_api_keys WHERE merchant_id=? ORDER BY created_at DESC').bind(merchantId).all();
  return rows.results||[];
}
