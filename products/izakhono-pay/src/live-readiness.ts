export const LIVE_READINESS_CHECKS = [
  'merchant_onboarding_complete',
  'kyb_verified',
  'provider_credentials_verified',
  'provider_webhook_verified',
  'production_domain_tls',
  'production_database',
  'legal_privacy_ready',
  'end_to_end_acceptance',
] as const;

export type LiveReadinessCheckCode = typeof LIVE_READINESS_CHECKS[number];

export async function initialiseLiveReadiness(db:D1Database,merchantId:string){
  const now=new Date().toISOString();
  for(const checkCode of LIVE_READINESS_CHECKS){
    await db.prepare(`INSERT OR IGNORE INTO pay_live_readiness_checks
      (id,merchant_id,check_code,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?)`)
      .bind(`ready_${crypto.randomUUID()}`,merchantId,checkCode,'pending',now,now).run();
  }
  return getLiveReadiness(db,merchantId);
}

export async function getLiveReadiness(db:D1Database,merchantId:string){
  const rows=await db.prepare(`SELECT check_code,status,evidence_ref,checked_at,notes,updated_at
    FROM pay_live_readiness_checks WHERE merchant_id=? ORDER BY check_code`).bind(merchantId).all();
  const checks=rows.results||[];
  const required=LIVE_READINESS_CHECKS.length;
  const passed=checks.filter((x:any)=>x.status==='passed'||x.status==='waived').length;
  return {merchant_id:merchantId,ready:checks.length===required&&passed===required,required,passed,checks};
}

export async function setLiveReadinessCheck(db:D1Database,merchantId:string,checkCode:string,status:string,evidenceRef?:string,notes?:string){
  if(!LIVE_READINESS_CHECKS.includes(checkCode as LiveReadinessCheckCode))throw new Error('unknown_readiness_check');
  if(!['pending','passed','failed','waived'].includes(status))throw new Error('invalid_readiness_status');
  const now=new Date().toISOString();
  const result=await db.prepare(`UPDATE pay_live_readiness_checks
    SET status=?,evidence_ref=?,checked_at=?,notes=?,updated_at=?
    WHERE merchant_id=? AND check_code=?`)
    .bind(status,evidenceRef||null,status==='pending'?null:now,notes||null,now,merchantId,checkCode).run();
  if(Number(result.meta?.changes||0)===0)throw new Error('readiness_check_not_initialised');
  return getLiveReadiness(db,merchantId);
}
