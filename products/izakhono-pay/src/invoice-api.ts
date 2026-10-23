import { authenticateMerchant } from './auth';
import { issueMerchantApiKey, listMerchantApiKeys, revokeMerchantApiKey } from './api-key-issuance';
import { createCustomer, createInvoice, recordInvoiceEvent, recordInvoicePayment, renderInvoice, setInvoiceStatus } from './invoicing';

const id=(p:string)=>`${p}_${crypto.randomUUID()}`;
const now=()=>new Date().toISOString();
const clean=(v:unknown,max=500)=>String(v??'').trim().slice(0,max);
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
async function body(req:Request){try{return await req.json() as Record<string,unknown>}catch{return null}}
async function allowed(req:Request,env:any,merchantId:string){if(env.PAY_API_KEY&&req.headers.get('authorization')===`Bearer ${env.PAY_API_KEY}`)return true;const a=await authenticateMerchant(req,env.DB);return !!a&&a.merchantId===merchantId}

export async function invoicePublicPage(req:Request,env:any,token:string){
  const inv=await env.DB.prepare('SELECT * FROM pay_invoices WHERE payment_token=?').bind(token).first<any>();
  if(!inv||inv.status==='void')return new Response('Invoice unavailable',{status:404});
  const customer=inv.customer_id?await env.DB.prepare('SELECT name,email,phone FROM pay_customers WHERE id=?').bind(inv.customer_id).first<any>():null;
  const items=await env.DB.prepare('SELECT description,quantity,unit_amount,line_total FROM pay_invoice_items WHERE invoice_id=? ORDER BY created_at').bind(inv.id).all();
  return new Response(renderInvoice('Invoice',inv,customer,items.results||[]),{headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store'}});
}

export async function invoiceApi(req:Request,env:any,path:string){
  const km=path.match(/^\/v1\/merchants\/([^/]+)\/api-keys$/);
  if(km){
    if(!await allowed(req,env,km[1]))return json({error:'merchant_unauthorized'},403);
    if(req.method==='POST'){
      const b=await body(req);
      if(b===null)return json({error:'invalid_json'},400);
      const label=clean(b.label,120)||'Primary API key';
      const issued=await issueMerchantApiKey(env.DB,km[1],label);
      if(!issued)return json({error:'merchant_not_found'},404);
      return json({id:issued.id,prefix:issued.prefix,label:issued.label,status:issued.status,api_key:issued.key,warning:'Store this API key securely. It will not be shown again.'},201);
    }
    if(req.method==='GET')return json({merchant_id:km[1],data:await listMerchantApiKeys(env.DB,km[1])});
  }
  const kr=path.match(/^\/v1\/merchants\/([^/]+)\/api-keys\/([^/]+)\/revoke$/);
  if(kr&&req.method==='POST'){
    if(!await allowed(req,env,kr[1]))return json({error:'merchant_unauthorized'},403);
    const revoked=await revokeMerchantApiKey(env.DB,kr[1],kr[2]);
    return revoked?json({id:kr[2],status:'revoked'}):json({error:'api_key_not_found_or_already_revoked'},404);
  }
  const cm=path.match(/^\/v1\/merchants\/([^/]+)\/customers$/);
  if(cm){if(!await allowed(req,env,cm[1]))return json({error:'merchant_unauthorized'},403);if(req.method==='POST'){const b=await body(req);if(!b)return json({error:'invalid_json'},400);try{return json(await createCustomer(env.DB,cm[1],b),201)}catch(e){return json({error:String((e as Error).message||e)},400)}}if(req.method==='GET'){const rows=await env.DB.prepare('SELECT id,name,email,phone,external_ref,status,created_at,updated_at FROM pay_customers WHERE merchant_id=? AND status=\'active\' ORDER BY created_at DESC').bind(cm[1]).all();return json({merchant_id:cm[1],data:rows.results||[]})}}
  const im=path.match(/^\/v1\/merchants\/([^/]+)\/invoices$/);
  if(im){if(!await allowed(req,env,im[1]))return json({error:'merchant_unauthorized'},403);if(req.method==='POST'){const b=await body(req);if(!b)return json({error:'invalid_json'},400);if(b.customer_id){const c=await env.DB.prepare('SELECT id FROM pay_customers WHERE id=? AND merchant_id=?').bind(clean(b.customer_id,120),im[1]).first();if(!c)return json({error:'customer_not_found'},404)}try{return json(await createInvoice(env.DB,im[1],b),201)}catch(e){return json({error:String((e as Error).message||e)},400)}}if(req.method==='GET'){const rows=await env.DB.prepare('SELECT id,customer_id,invoice_number,currency,subtotal,tax,total,amount_paid,balance_due,status,due_at,issued_at,paid_at,notes,payment_token,created_at,updated_at FROM pay_invoices WHERE merchant_id=? ORDER BY created_at DESC').bind(im[1]).all();return json({merchant_id:im[1],data:rows.results||[]})}}
  const one=path.match(/^\/v1\/invoices\/([^/]+)$/);
  if(one&&req.method==='GET'){const inv=await env.DB.prepare('SELECT * FROM pay_invoices WHERE id=?').bind(one[1]).first<any>();if(!inv)return json({error:'invoice_not_found'},404);if(!await allowed(req,env,inv.merchant_id))return json({error:'merchant_unauthorized'},403);const customer=inv.customer_id?await env.DB.prepare('SELECT * FROM pay_customers WHERE id=?').bind(inv.customer_id).first():null;const items=await env.DB.prepare('SELECT * FROM pay_invoice_items WHERE invoice_id=? ORDER BY created_at').bind(inv.id).all();return json({...inv,customer,items:items.results||[]})}
  const send=path.match(/^\/v1\/invoices\/([^/]+)\/send$/);
  if(send&&req.method==='POST'){const inv=await env.DB.prepare('SELECT * FROM pay_invoices WHERE id=?').bind(send[1]).first<any>();if(!inv)return json({error:'invoice_not_found'},404);if(!await allowed(req,env,inv.merchant_id))return json({error:'merchant_unauthorized'},403);try{await setInvoiceStatus(env.DB,send[1],'sent');return json({id:send[1],status:'sent',delivery:'not_configured'})}catch(e){return json({error:String((e as Error).message||e)},400)}}
  const voided=path.match(/^\/v1\/invoices\/([^/]+)\/void$/);
  if(voided&&req.method==='POST'){const inv=await env.DB.prepare('SELECT * FROM pay_invoices WHERE id=?').bind(voided[1]).first<any>();if(!inv)return json({error:'invoice_not_found'},404);if(!await allowed(req,env,inv.merchant_id))return json({error:'merchant_unauthorized'},403);try{await setInvoiceStatus(env.DB,voided[1],'void');return json({id:voided[1],status:'void'})}catch(e){return json({error:String((e as Error).message||e)},400)}}
  return null;
}

export async function attachInvoicePayment(env:any,paymentId:string,status:string){
  if(!['authorised','settled'].includes(status))return;
  const p=await env.DB.prepare('SELECT merchant_id,amount FROM pay_payment_intents WHERE id=?').bind(paymentId).first<any>();if(!p)return;
  const link=await env.DB.prepare('SELECT id FROM pay_invoice_events WHERE event_type=\'invoice.payment_intent_linked\' AND json_extract(metadata_json,\'$.payment_id\')=? LIMIT 1').bind(paymentId).first();
  if(link)return;
  const invEvent=await env.DB.prepare('SELECT invoice_id FROM pay_invoice_events WHERE event_type=\'invoice.payment_intent_linked\' AND json_extract(metadata_json,\'$.payment_id\')=? LIMIT 1').bind(paymentId).first<any>();
  if(invEvent)await recordInvoicePayment(env.DB,invEvent.invoice_id,Number(p.amount),paymentId);
}

export async function linkInvoicePayment(env:any,invoiceId:string,paymentId:string){
  const inv=await env.DB.prepare('SELECT id FROM pay_invoices WHERE id=?').bind(invoiceId).first();if(!inv)throw new Error('invoice_not_found');
  await recordInvoiceEvent(env.DB,invoiceId,'invoice.payment_intent_linked',{payment_id:paymentId});
}
