import http from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const host=process.env.SIGN_HOST||'0.0.0.0';
const port=Number(process.env.PORT||process.env.SIGN_PORT||9898);
const dbPath=process.env.IZAKHONO_SIGN_DB||'/app/data/sign.sqlite';
const migration=process.env.SIGN_MIGRATION||'/app/migrations/0001_sign.sql';
const apiToken=process.env.SIGN_API_TOKEN||'';
const linkSecret=process.env.SIGN_LINK_SECRET||'';
const docflowUrl=(process.env.DOCFLOW_URL||'').replace(/\/$/,'');
const docflowServiceToken=process.env.DOCFLOW_SERVICE_TOKEN||'';
const publicBase=(process.env.SIGN_PUBLIC_BASE_URL||'').replace(/\/$/,'');
const mailUrl=(process.env.SIGN_MAIL_URL||'').replace(/\/$/,'');
const mailToken=process.env.SIGN_MAIL_TOKEN||'';
const linkDays=Math.max(1,Math.min(365,Number(process.env.SIGN_LINK_DAYS||30)));

mkdirSync(path.dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
db.exec(readFileSync(migration,'utf8'));

const uid=p=>p+'_'+crypto.randomUUID().replaceAll('-','');
const clean=(v,n=500)=>typeof v==='string'?v.trim().slice(0,n):'';
const sha=v=>crypto.createHash('sha256').update(v).digest('hex');
const hmac=v=>crypto.createHmac('sha256',linkSecret).update(v).digest('base64url');
const now=()=>new Date().toISOString();
const futureIso=days=>new Date(Date.now()+days*86400000).toISOString();
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function json(res,status,body){
  const raw=Buffer.from(JSON.stringify(body));
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':raw.length,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  res.end(raw);
}
function html(res,status,body){
  const raw=Buffer.from(body);
  res.writeHead(status,{'content-type':'text/html; charset=utf-8','content-length':raw.length,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'"});
  res.end(raw);
}
function authorized(req){
  if(!apiToken) return false;
  const auth=clean(req.headers.authorization||'',1024);
  const supplied=auth.startsWith('Bearer ')?auth.slice(7):clean(req.headers['x-sign-token']||'',1024);
  if(!supplied) return false;
  const a=Buffer.from(supplied),b=Buffer.from(apiToken);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
async function readBody(req,max=512*1024){
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>max)throw new Error('body_too_large');parts.push(part)}
  const raw=Buffer.concat(parts).toString('utf8');
  if(!raw)return{};
  const ct=String(req.headers['content-type']||'');
  if(ct.includes('application/json')){try{return JSON.parse(raw)}catch{throw new Error('invalid_json')}}
  if(ct.includes('application/x-www-form-urlencoded'))return Object.fromEntries(new URLSearchParams(raw));
  throw new Error('unsupported_content_type');
}
function audit(envelopeId,eventName,actor,detail={}){
  db.prepare('INSERT INTO sign_audit(id,envelope_id,event_name,actor,detail_json) VALUES(?,?,?,?,?)')
    .run(uid('aud'),envelopeId,eventName,clean(actor,120)||'system',JSON.stringify(detail).slice(0,10000));
}
function envelopeByAction(actionId){return db.prepare('SELECT * FROM sign_envelopes WHERE action_id=?').get(actionId)}
function envelopeByToken(token){return db.prepare('SELECT * FROM sign_envelopes WHERE token_hash=?').get(sha(token))}
function tokenFor(row){return hmac(row.id+':'+row.action_id+':'+row.draft_id)}
function view(row){
  if(!row)return null;
  return {
    id:row.id,action_id:row.action_id,event_id:row.event_id,workspace_id:row.workspace_id,legal_entity:row.legal_entity,
    draft_id:row.draft_id,title:row.title,recipient_name:row.recipient_name,recipient_email:row.recipient_email,
    signature_required:Boolean(row.signature_required),content_sha256:row.content_sha256,status:row.status,mail_status:row.mail_status,
    expires_at:row.expires_at,dispatched_at:row.dispatched_at,signed_at:row.signed_at,signer_name:row.signer_name,
    created_at:row.created_at,updated_at:row.updated_at,
    public_link:publicBase?publicBase+'/sign/'+tokenFor(row):null
  };
}
async function docflow(pathname,options={}){
  if(!docflowUrl||!docflowServiceToken)throw new Error('docflow_adapter_not_configured');
  const headers=new Headers(options.headers||{});
  headers.set('authorization','Bearer '+docflowServiceToken);
  if(options.body&&!headers.has('content-type'))headers.set('content-type','application/json');
  return fetch(docflowUrl+pathname,{...options,headers});
}
async function fetchDocument(draftId){
  const r=await docflow('/api/internal/drafts/'+encodeURIComponent(draftId)+'/delivery-payload');
  if(!r.ok)throw new Error('docflow_http_'+r.status);
  const d=await r.json();
  if(!d?.ok||!d?.document)throw new Error('docflow_payload_invalid');
  return d.document;
}
async function updateDocflowStatus(draftId,status,detail={}){
  try{
    const r=await docflow('/api/internal/drafts/'+encodeURIComponent(draftId)+'/delivery-status',{
      method:'POST',body:JSON.stringify({status,source:'IZAKHONO SIGN',detail})
    });
    return r.ok;
  }catch{return false}
}
async function dispatchMail(row){
  if(!publicBase)return {claim:'link_not_public',state:'awaiting_public_route'};
  if(!mailUrl)return {claim:'signing_link_ready_not_sent',state:'awaiting_mail'};
  const link=publicBase+'/sign/'+tokenFor(row);
  const subject=row.signature_required?'Signature requested: '+row.title:'Document: '+row.title;
  const body=row.signature_required
    ? 'A document is ready for your review and electronic signature. Open the secure link: '+link
    : 'A document is ready for your review. Open the secure link: '+link;
  const headers={'content-type':'application/json'};
  if(mailToken)headers.authorization='Bearer '+mailToken;
  const r=await fetch(mailUrl+'/v1/send',{method:'POST',headers,body:JSON.stringify({
    idempotency_key:row.action_id,
    to:{name:row.recipient_name,email:row.recipient_email},
    subject,body_text:body,
    metadata:{workspace_id:row.workspace_id,legal_entity:row.legal_entity,draft_id:row.draft_id,envelope_id:row.id}
  })});
  if(!r.ok)throw new Error('mail_http_'+r.status);
  db.prepare("UPDATE sign_envelopes SET status='dispatched',mail_status='outbound_accepted',dispatched_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
  audit(row.id,'mail.outbound_accepted','izakhono-sign',{recipient_email_hash:sha(row.recipient_email)});
  await updateDocflowStatus(row.draft_id,'outbound_accepted',{envelope_id:row.id});
  return {claim:'outbound_accepted',state:'completed'};
}
async function createOrDispatch(input){
  const actionId=clean(input.action_id,180),eventId=clean(input.event_id,180),actionType=clean(input.action_type,120);
  const payload=input.payload&&typeof input.payload==='object'?input.payload:{};
  if(!actionId||!eventId||actionType!=='document_delivery')throw new Error('invalid_delivery_action');
  let row=envelopeByAction(actionId);
  if(!row){
    const draftId=clean(payload.draft_id||payload.subject_id,180);
    if(!draftId)throw new Error('draft_id_required');
    const doc=await fetchDocument(draftId);
    const recipientEmail=clean(doc.recipient_email,320).toLowerCase();
    if(!recipientEmail||!recipientEmail.includes('@'))throw new Error('recipient_email_required');
    const id=uid('env');
    const token=hmac(id+':'+actionId+':'+draftId);
    db.prepare(`INSERT INTO sign_envelopes(
      id,action_id,event_id,workspace_id,legal_entity,draft_id,title,recipient_name,recipient_email,signature_required,
      content_sha256,token_hash,status,mail_status,expires_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,actionId,eventId,clean(doc.workspace_id,120),clean(doc.legal_entity,200),draftId,clean(doc.title,240),
      clean(doc.recipient_name,200),recipientEmail,doc.signature_required?1:0,clean(doc.content_sha256,128),sha(token),
      publicBase?'link_ready':'awaiting_public_route',mailUrl?'queued':'not_configured',futureIso(linkDays)
    );
    row=envelopeByAction(actionId);
    audit(id,'envelope.created','izakhono-sign',{signature_required:Boolean(row.signature_required),content_sha256:row.content_sha256});
    if(publicBase)await updateDocflowStatus(draftId,'link_ready',{envelope_id:id});
  }
  if(row.signed_at)return {envelope:view(row),delivery_claim:'signed',flowiq_state:'completed'};
  const result=await dispatchMail(row);
  row=envelopeByAction(actionId);
  return {envelope:view(row),delivery_claim:result.claim,flowiq_state:result.state};
}
async function validatedDocument(row){
  if(new Date(row.expires_at).getTime()<Date.now())throw new Error('link_expired');
  const doc=await fetchDocument(row.draft_id);
  if(clean(doc.content_sha256,128)!==row.content_sha256)throw new Error('document_changed_after_envelope');
  return doc;
}
function signingPage(row,doc,message=''){
  const action=row.signature_required
    ? `<form method="post" action="/sign/${esc(tokenFor(row))}/complete"><label>Type your full name<input name="signer_name" required maxlength="200"></label><label class="check"><input type="checkbox" name="confirm" value="true" required> I have reviewed this document and intend this action to record my electronic acceptance.</label><button type="submit">Sign document</button></form>`
    : '<p class="notice">This document was sent for review and does not require an electronic signature in DOCFLOW.</p>';
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(row.title)} — IZAKHONO SIGN</title><style>
  body{margin:0;font-family:Inter,system-ui,sans-serif;background:#071018;color:#eef8ff}.wrap{max-width:900px;margin:auto;padding:28px 18px 70px}.brand{font-weight:900;letter-spacing:.08em;color:#67dcff}.card{background:#0d1821;border:1px solid #294252;border-radius:20px;padding:22px;margin-top:20px}.doc{white-space:pre-wrap;background:#f7f9fb;color:#101820;padding:22px;border-radius:14px;line-height:1.55;overflow:auto}label{display:grid;gap:7px;margin:16px 0}input[type=text],input:not([type]){padding:12px;border-radius:10px;border:1px solid #496676;background:#08131b;color:#fff}.check{display:block;line-height:1.5}button{padding:13px 18px;border:0;border-radius:10px;font-weight:900;background:#65dcff;color:#061018;cursor:pointer}.meta,.notice{color:#a9c0cd}.ok{padding:12px;border-radius:10px;background:#113023;color:#9df2be}</style></head><body><div class="wrap"><div class="brand">IZAKHONO SIGN</div><div class="card"><h1>${esc(row.title)}</h1><p class="meta">From ${esc(row.legal_entity)} · Reference ${esc(row.draft_id)}</p>${message?'<div class="ok">'+esc(message)+'</div>':''}<div class="doc">${esc(doc.content_markdown)}</div>${action}<p class="meta">This service records the document hash, time and stated signer name. Electronic-signature requirements can differ by document type and jurisdiction.</p></div></div></body></html>`;
}

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/','http://'+(req.headers.host||'localhost'));
    if(url.pathname==='/healthz'&&req.method==='GET')return json(res,200,{ok:true,service:'IZAKHONO SIGN',version:'1.0.0'});
    if(url.pathname==='/readyz'&&req.method==='GET'){
      let database=false;try{database=db.prepare('SELECT 1 AS ok').get()?.ok===1}catch{}
      const ready=database&&Boolean(apiToken)&&Boolean(linkSecret)&&Boolean(docflowUrl)&&Boolean(docflowServiceToken);
      return json(res,ready?200:503,{ok:ready,service:'IZAKHONO SIGN',database:database?'ready':'error',api_auth_configured:Boolean(apiToken),link_secret_configured:Boolean(linkSecret),docflow_configured:Boolean(docflowUrl&&docflowServiceToken),public_route_configured:Boolean(publicBase),mail_adapter_configured:Boolean(mailUrl)});
    }

    const signMatch=url.pathname.match(/^\/sign\/([^/]+)$/);
    if(signMatch&&req.method==='GET'){
      const token=decodeURIComponent(signMatch[1]),row=envelopeByToken(token);
      if(!row)return html(res,404,'<h1>Signing link not found</h1>');
      try{const doc=await validatedDocument(row);return html(res,200,signingPage(row,doc,row.signed_at?'Already signed by '+row.signer_name+'.':''))}
      catch(error){return html(res,410,'<h1>Signing link unavailable</h1><p>'+esc(String(error?.message||error))+'</p>')}
    }

    const completeMatch=url.pathname.match(/^\/sign\/([^/]+)\/complete$/);
    if(completeMatch&&req.method==='POST'){
      const token=decodeURIComponent(completeMatch[1]),row=envelopeByToken(token);
      if(!row)return html(res,404,'<h1>Signing link not found</h1>');
      const body=await readBody(req);
      const signerName=clean(body.signer_name,200),confirm=body.confirm===true||body.confirm==='true';
      if(!row.signature_required)return html(res,409,'<h1>No signature required</h1>');
      if(row.signed_at){const doc=await validatedDocument(row);return html(res,200,signingPage(row,doc,'Already signed by '+row.signer_name+'.'))}
      if(!signerName||!confirm)return html(res,400,'<h1>Name and confirmation are required</h1>');
      const doc=await validatedDocument(row);
      db.prepare("UPDATE sign_envelopes SET status='signed',signed_at=CURRENT_TIMESTAMP,signer_name=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(signerName,row.id);
      audit(row.id,'envelope.signed',signerName,{content_sha256:row.content_sha256,user_agent_sha256:sha(clean(req.headers['user-agent']||'',500))});
      await updateDocflowStatus(row.draft_id,'signed',{envelope_id:row.id,signer_name:signerName});
      const updated=envelopeByAction(row.action_id);
      return html(res,200,signingPage(updated,doc,'Signature recorded successfully.'));
    }

    if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});

    if(url.pathname==='/v1/actions'&&req.method==='POST'){
      const input=await readBody(req);
      try{
        const out=await createOrDispatch(input);
        const status=out.flowiq_state==='completed'?200:202;
        return json(res,status,{ok:true,...out});
      }catch(error){
        const message=String(error?.message||error);
        const status=/required|invalid/.test(message)?422:503;
        return json(res,status,{ok:false,error:message});
      }
    }

    if(url.pathname==='/v1/envelopes'&&req.method==='GET'){
      const rows=db.prepare('SELECT * FROM sign_envelopes ORDER BY created_at DESC LIMIT 100').all();
      return json(res,200,{ok:true,envelopes:rows.map(view)});
    }

    return json(res,404,{ok:false,error:'not_found'});
  }catch(error){
    const message=String(error?.message||error);
    const status=message==='body_too_large'?413:message==='invalid_json'?400:500;
    return json(res,status,{ok:false,error:status===500?'sign_error':message,detail:status===500?message.slice(0,300):undefined});
  }
});

server.listen(port,host,()=>{
  console.log('[IZAKHONO SIGN] listening on http://'+host+':'+port);
  console.log('[IZAKHONO SIGN] DOCFLOW='+(docflowUrl?'configured':'missing'));
  console.log('[IZAKHONO SIGN] public route='+(publicBase?'configured':'not-configured'));
  console.log('[IZAKHONO SIGN] mail='+(mailUrl?'configured':'not-configured'));
});
