export type PaymentStatus = 'initiated'|'pending'|'authorised'|'failed'|'reversed'|'refunded'|'settled'|'disputed';

export interface Env { DB: D1Database; PAY_API_KEY?: string; PAY_WEBHOOK_SECRET?: string; }

const json = (data: unknown, status=200, extra: Record<string,string>={}) => new Response(JSON.stringify(data), {status, headers:{'content-type':'application/json; charset=utf-8', 'cache-control':'no-store', ...extra}});
const id = (p:string) => `${p}_${crypto.randomUUID()}`;
const now = () => new Date().toISOString();
const money = (v:unknown) => { const n=Number(v); return Number.isFinite(n)&&n>=0 ? Math.round(n*100)/100 : null; };
const clean=(v:unknown,max=200)=>String(v??'').trim().slice(0,max);

async function hmac(secret:string, body:string){ const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']); const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(body)); return [...new Uint8Array(sig)].map(x=>x.toString(16).padStart(2,'0')).join(''); }
async function auth(req:Request, env:Env){ if(!env.PAY_API_KEY) return true; return req.headers.get('authorization')===`Bearer ${env.PAY_API_KEY}`; }

async function body(req:Request){ try{return await req.json() as Record<string,unknown>}catch{return null} }

export default { async fetch(req:Request,env:Env):Promise<Response>{
  const url=new URL(req.url); const path=url.pathname;
  if(req.method==='GET'&&path==='/health') return json({ok:true,service:'izakhono-pay-v1',ownedFirst:true,providerReplaceable:true,regulatedPartnerBoundary:true});
  if(!(await auth(req,env))) return json({error:'unauthorized'},401);
  if(path.startsWith('/v1/webhooks/')) return webhook(req,env,path.split('/').pop()||'unknown');
  if(!env.DB) return json({error:'database_not_configured'},503);

  if(req.method==='POST'&&path==='/v1/merchants'){
    const b=await body(req); if(!b) return json({error:'invalid_json'},400);
    const merchantId=id('mch'); const name=clean(b.name,160); if(!name)return json({error:'name_required'},400);
    await env.DB.prepare('INSERT INTO pay_merchants (id,name,email,status,created_at) VALUES (?,?,?,?,?)').bind(merchantId,name,clean(b.email,254),'pending_kyb',now()).run();
    return json({id:merchantId,name,status:'pending_kyb'},201);
  }
  const merchantMatch=path.match(/^\/v1\/merchants\/([^/]+)$/); if(req.method==='GET'&&merchantMatch){ const r=await env.DB.prepare('SELECT id,name,email,status,created_at FROM pay_merchants WHERE id=?').bind(merchantMatch[1]).first(); return r?json(r):json({error:'not_found'},404); }

  if(req.method==='POST'&&path==='/v1/payment-intents'){
    const b=await body(req); if(!b)return json({error:'invalid_json'},400); const merchantId=clean(b.merchant_id,120), currency=clean(b.currency||'ZAR',8).toUpperCase(), amount=money(b.amount), idem=req.headers.get('idempotency-key');
    if(!merchantId||amount===null||amount<=0||!idem)return json({error:'merchant_id_amount_and_idempotency_key_required'},400);
    const prior=await env.DB.prepare('SELECT * FROM pay_payment_intents WHERE merchant_id=? AND idempotency_key=?').bind(merchantId,idem).first(); if(prior)return json(prior);
    const paymentId=id('pay'); const created=now();
    await env.DB.prepare('INSERT INTO pay_payment_intents (id,merchant_id,amount,currency,status,description,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(paymentId,merchantId,amount,currency,'initiated',clean(b.description,500),idem,created,created).run();
    await env.DB.prepare('INSERT INTO pay_ledger_events (id,payment_id,event_type,status,created_at,payload_json) VALUES (?,?,?,?,?,?)').bind(id('evt'),paymentId,'payment.created','initiated',created,JSON.stringify({merchant_id:merchantId,amount,currency})).run();
    return json({id:paymentId,merchant_id:merchantId,amount,currency,status:'initiated',next_action:'provider_adapter'},201);
  }
  const payMatch=path.match(/^\/v1\/payment-intents\/([^/]+)$/); if(req.method==='GET'&&payMatch){const r=await env.DB.prepare('SELECT * FROM pay_payment_intents WHERE id=?').bind(payMatch[1]).first();return r?json(r):json({error:'not_found'},404);}

  if(req.method==='POST'&&path==='/v1/payment-links'){
    const b=await body(req); if(!b)return json({error:'invalid_json'},400); const amount=money(b.amount), merchantId=clean(b.merchant_id,120); if(amount===null||amount<=0||!merchantId)return json({error:'merchant_id_and_positive_amount_required'},400);
    const linkId=id('lnk'); const token=crypto.randomUUID().replaceAll('-',''); await env.DB.prepare('INSERT INTO pay_links (id,merchant_id,token,amount,currency,title,status,created_at) VALUES (?,?,?,?,?,?,?,?)').bind(linkId,merchantId,token,amount,clean(b.currency||'ZAR',8).toUpperCase(),clean(b.title,160),'active',now()).run(); return json({id:linkId,url:`/pay/${token}`,amount,currency:clean(b.currency||'ZAR',8).toUpperCase(),status:'active'},201);
  }

  if(req.method==='POST'&&path==='/v1/refunds'){ const b=await body(req); if(!b)return json({error:'invalid_json'},400); const paymentId=clean(b.payment_id,120), amount=money(b.amount); if(!paymentId||amount===null||amount<=0)return json({error:'payment_id_and_positive_amount_required'},400); const rid=id('ref'); await env.DB.prepare('INSERT INTO pay_refunds (id,payment_id,amount,status,reason,created_at) VALUES (?,?,?,?,?,?)').bind(rid,paymentId,amount,'requested',clean(b.reason,300),now()).run(); return json({id:rid,payment_id:paymentId,amount,status:'requested'},201); }
  if(req.method==='POST'&&path==='/v1/reconciliation/settlements'){ const b=await body(req); if(!b)return json({error:'invalid_json'},400); const sid=id('set'); await env.DB.prepare('INSERT INTO pay_settlements (id,merchant_id,provider,reference,gross_amount,fees,net_amount,status,settled_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(sid,clean(b.merchant_id,120),clean(b.provider,100),clean(b.reference,160),money(b.gross_amount),money(b.fees),money(b.net_amount),'received',clean(b.settled_at,40)||now()).run(); return json({id:sid,status:'received'},201); }
  return json({error:'not_found'},404);
}}

async function webhook(req:Request,env:Env,provider:string){
  const raw=await req.text(); if(env.PAY_WEBHOOK_SECRET){const expected=await hmac(env.PAY_WEBHOOK_SECRET,raw); if(req.headers.get('x-izakhono-signature')!==expected)return json({error:'invalid_signature'},401);}
  let b:Record<string,unknown>; try{b=JSON.parse(raw)}catch{return json({error:'invalid_json'},400)} const paymentId=clean(b.payment_id,120), status=clean(b.status,30) as PaymentStatus; if(!paymentId||!['pending','authorised','failed','reversed','refunded','settled','disputed'].includes(status))return json({error:'unsupported_event'},400);
  if(!env.DB)return json({error:'database_not_configured'},503); const t=now(); await env.DB.prepare('UPDATE pay_payment_intents SET status=?,updated_at=? WHERE id=?').bind(status,t,paymentId).run(); await env.DB.prepare('INSERT INTO pay_ledger_events (id,payment_id,event_type,status,created_at,payload_json) VALUES (?,?,?,?,?,?)').bind(id('evt'),paymentId,`provider.${provider}`,status,t,JSON.stringify(b)).run(); return json({ok:true,payment_id:paymentId,status});
}
