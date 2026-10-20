import http from 'node:http';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8090);
const MAIL_API_URL = String(process.env.IZAKHONO_MAIL_API_URL || '').replace(/\/$/, '');
const MAIL_API_TOKEN = process.env.IZAKHONO_MAIL_API_TOKEN || '';
const routes = JSON.parse(await fs.readFile(new URL('./routes.json', import.meta.url), 'utf8'));
const windows = new Map();
const WINDOW_MS = 60_000;

function json(res,status,value){res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});res.end(JSON.stringify(value));}
function host(req){return String(req.headers.host||'').split(':')[0].toLowerCase().replace(/^www\./,'');}
function clean(value,max=4000){return String(value??'').trim().slice(0,max);}
function validEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);}
async function readBody(req){let total=0;const chunks=[];for await(const chunk of req){total+=chunk.length;if(total>65536)throw new Error('Request too large');chunks.push(chunk);}const text=Buffer.concat(chunks).toString('utf8');return text?JSON.parse(text):{};}
function allowed(ip){const now=Date.now();const x=windows.get(ip);if(!x||now-x.started>=WINDOW_MS){windows.set(ip,{started:now,count:1});return true;}if(x.count>=10)return false;x.count++;return true;}
async function sendMail(route,data){if(!MAIL_API_URL||!MAIL_API_TOKEN)return {ok:false,status:503,error:'IZAKHONO MAIL transport is not configured'};const key=`contact_${crypto.randomUUID()}`;const payload={idempotency_key:key,to:{email:route.to},from:route.from,reply_to:data.email,subject:`Website enquiry — ${data.name}`,body_text:`Name: ${data.name}\nOrganisation: ${data.organisation||'-'}\nEmail: ${data.email}\nInterest: ${data.interest||'-'}\n\n${data.message}`,metadata:{source:route.source,domain:host(data.req)}};const r=await fetch(`${MAIL_API_URL}/v1/send`,{method:'POST',headers:{authorization:`Bearer ${MAIL_API_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(payload)});const raw=await r.text();let out={};try{out=raw?JSON.parse(raw):{};}catch{}if(!r.ok)return {ok:false,status:r.status,error:out.error||'Mail transport rejected the message'};return {ok:true,provider:'izakhono-mail',outbox_id:out.outbox_id||out.id||null};}

const server=http.createServer(async(req,res)=>{
  if(req.method==='GET'&&req.url==='/health')return json(res,200,{ok:true,service:'IZAKHONO Contact Gateway',version:'0.1.0',mail_configured:Boolean(MAIL_API_URL&&MAIL_API_TOKEN)});
  if(req.method!=='POST'||req.url!=='/api/contact')return json(res,405,{ok:false,error:'Method not allowed'});
  const route=routes[host(req)];if(!route)return json(res,404,{ok:false,error:'Contact route not provisioned'});
  if(!allowed(req.socket.remoteAddress||'unknown'))return json(res,429,{ok:false,error:'Too many requests'});
  try{const data=await readBody(req);if(clean(data.website))return json(res,200,{ok:true,accepted:true});data.name=clean(data.name,160);data.organisation=clean(data.organisation,200);data.email=clean(data.email,320);data.interest=clean(data.interest,160);data.message=clean(data.message,8000);if(!data.name||!data.email||!data.message)return json(res,400,{ok:false,error:'Name, email and message are required'});if(!validEmail(data.email))return json(res,400,{ok:false,error:'Invalid email address'});data.req=req;const result=await sendMail(route,data);if(!result.ok)return json(res,result.status||502,{ok:false,error:result.error});return json(res,202,{ok:true,accepted:true,provider:result.provider,outbox_id:result.outbox_id});}catch(e){return json(res,400,{ok:false,error:e?.message||'Invalid request'});}
});
server.listen(PORT,'0.0.0.0',()=>console.log(`IZAKHONO Contact Gateway listening on ${PORT}`));
