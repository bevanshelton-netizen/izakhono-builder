import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const host=process.env.MAIL_HOST||'0.0.0.0';
const port=Number(process.env.PORT||process.env.MAIL_PORT||9899);
const dbPath=process.env.IZAKHONO_MAIL_DB||'/app/data/mail.sqlite';
const migration=process.env.MAIL_MIGRATION||'/app/migrations/0001_mail.sql';
const apiToken=process.env.MAIL_API_TOKEN||'';
const smtpHost=process.env.MAIL_SMTP_HOST||'';
const smtpPort=Number(process.env.MAIL_SMTP_PORT||587);
const smtpSecure=String(process.env.MAIL_SMTP_SECURE||'false').toLowerCase()==='true';
const smtpStarttls=String(process.env.MAIL_SMTP_STARTTLS||'true').toLowerCase()==='true';
const smtpUser=process.env.MAIL_SMTP_USER||'';
const smtpPass=process.env.MAIL_SMTP_PASSWORD||'';
const fromEmail=process.env.MAIL_FROM_EMAIL||'';
const fromName=process.env.MAIL_FROM_NAME||'IZAKHONO';
const smtpTimeout=Math.max(3000,Math.min(60000,Number(process.env.MAIL_SMTP_TIMEOUT_MS||15000)));

mkdirSync(path.dirname(dbPath),{recursive:true});
const db=new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL;');
db.exec(readFileSync(migration,'utf8'));

const uid=p=>p+'_'+crypto.randomUUID().replaceAll('-','');
const clean=(v,n=1000)=>typeof v==='string'?v.trim().slice(0,n):'';
const header=v=>clean(v,500).replace(/[\r\n]+/g,' ');
const email=v=>clean(v,320).toLowerCase();
const now=()=>new Date().toISOString();

function json(res,status,body){
  const raw=Buffer.from(JSON.stringify(body));
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':raw.length,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'});
  res.end(raw);
}
function authorized(req){
  if(!apiToken)return false;
  const auth=clean(req.headers.authorization||'',1024);
  const supplied=auth.startsWith('Bearer ')?auth.slice(7):clean(req.headers['x-mail-token']||'',1024);
  if(!supplied)return false;
  const a=Buffer.from(supplied),b=Buffer.from(apiToken);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
async function readJson(req,max=512*1024){
  const parts=[];let size=0;
  for await(const part of req){size+=part.length;if(size>max)throw new Error('body_too_large');parts.push(part)}
  if(!parts.length)return{};
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'))}catch{throw new Error('invalid_json')}
}
function audit(outboxId,eventName,detail={}){
  db.prepare('INSERT INTO mail_audit(id,outbox_id,event_name,detail_json) VALUES(?,?,?,?)')
    .run(uid('aud'),outboxId,eventName,JSON.stringify(detail).slice(0,8000));
}
function smtpConfigured(){return Boolean(smtpHost&&fromEmail)}

function encodeSubject(value){
  const s=header(value);
  return /^[\x20-\x7E]*$/.test(s)?s:'=?UTF-8?B?'+Buffer.from(s,'utf8').toString('base64')+'?=';
}
function formatAddress(name,addr){
  const safe=header(name).replace(/["\\]/g,'');
  return safe?'"'+safe+'" <'+addr+'>':'<'+addr+'>';
}
function buildMessage(row){
  const domain=(fromEmail.split('@')[1]||'izakhono.local').replace(/[^a-zA-Z0-9.-]/g,'');
  const messageId='<'+crypto.randomUUID()+'@'+domain+'>';
  const body=String(row.body_text||'').replace(/\r?\n/g,'\r\n').replace(/^\./gm,'..');
  const lines=[
    'Date: '+new Date().toUTCString(),
    'Message-ID: '+messageId,
    'From: '+formatAddress(fromName,fromEmail),
    'To: '+formatAddress(row.recipient_name,row.recipient_email),
    'Subject: '+encodeSubject(row.subject),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'Auto-Submitted: auto-generated',
    '',
    body,
    ''
  ];
  return {messageId,data:lines.join('\r\n')};
}
function readReply(socket){
  return new Promise((resolve,reject)=>{
    let buf='';
    const timer=setTimeout(()=>done(new Error('smtp_timeout')),smtpTimeout);
    function done(err,value){
      clearTimeout(timer);socket.off('data',onData);socket.off('error',onError);socket.off('close',onClose);
      err?reject(err):resolve(value);
    }
    function onError(e){done(e)}
    function onClose(){done(new Error('smtp_closed'))}
    function onData(chunk){
      buf+=chunk.toString('utf8');
      const lines=buf.split(/\r?\n/).filter(Boolean);
      const last=lines.at(-1)||'';
      if(/^\d{3} /.test(last)){
        const code=Number(last.slice(0,3));
        done(null,{code,text:lines.join('\n')});
      }
    }
    socket.on('data',onData);socket.on('error',onError);socket.on('close',onClose);
  });
}
async function command(socket,line,allowed=[250]){
  socket.write(line+'\r\n');
  const reply=await readReply(socket);
  if(!allowed.includes(reply.code))throw new Error('smtp_'+reply.code+'_'+reply.text.slice(0,160));
  return reply;
}
async function connectSocket(){
  const socket=smtpSecure
    ? tls.connect({host:smtpHost,port:smtpPort,servername:smtpHost,rejectUnauthorized:true})
    : net.connect({host:smtpHost,port:smtpPort});
  await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('smtp_connect_timeout')),smtpTimeout);
    const event=smtpSecure?'secureConnect':'connect';
    socket.once(event,()=>{clearTimeout(timer);resolve()});
    socket.once('error',e=>{clearTimeout(timer);reject(e)});
  });
  return socket;
}
async function sendSmtp(row){
  let socket=await connectSocket();
  let greeting=await readReply(socket);
  if(greeting.code!==220)throw new Error('smtp_bad_greeting_'+greeting.code);
  await command(socket,'EHLO izakhono-mail',[250]);

  if(!smtpSecure&&smtpStarttls){
    await command(socket,'STARTTLS',[220]);
    socket=tls.connect({socket,servername:smtpHost,rejectUnauthorized:true});
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('smtp_tls_timeout')),smtpTimeout);
      socket.once('secureConnect',()=>{clearTimeout(timer);resolve()});
      socket.once('error',e=>{clearTimeout(timer);reject(e)});
    });
    await command(socket,'EHLO izakhono-mail',[250]);
  }

  if(smtpUser){
    const auth=Buffer.from('\0'+smtpUser+'\0'+smtpPass,'utf8').toString('base64');
    await command(socket,'AUTH PLAIN '+auth,[235]);
  }

  await command(socket,'MAIL FROM:<'+fromEmail+'>',[250]);
  await command(socket,'RCPT TO:<'+row.recipient_email+'>',[250,251]);
  await command(socket,'DATA',[354]);
  const msg=buildMessage(row);
  socket.write(msg.data+'\r\n.\r\n');
  const accepted=await readReply(socket);
  if(accepted.code!==250)throw new Error('smtp_data_'+accepted.code+'_'+accepted.text.slice(0,160));
  try{await command(socket,'QUIT',[221])}catch{}
  socket.end();
  return {messageId:msg.messageId,reply:accepted.text.slice(0,300)};
}
function outboxView(row){
  if(!row)return null;
  return {id:row.id,idempotency_key:row.idempotency_key,recipient_name:row.recipient_name,recipient_email:row.recipient_email,subject:row.subject,state:row.state,attempts:row.attempts,last_error:row.last_error,smtp_message_id:row.smtp_message_id,accepted_at:row.accepted_at,created_at:row.created_at,updated_at:row.updated_at};
}
async function attempt(row){
  if(!smtpConfigured()){
    db.prepare("UPDATE mail_outbox SET state='awaiting_smtp',updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
    return {delivery_claim:'awaiting_smtp',outbound_state:'awaiting_smtp'};
  }
  db.prepare("UPDATE mail_outbox SET state='sending',attempts=attempts+1,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
  audit(row.id,'smtp.attempt',{host:smtpHost,port:smtpPort,secure:smtpSecure,starttls:smtpStarttls});
  try{
    const result=await sendSmtp(row);
    db.prepare("UPDATE mail_outbox SET state='outbound_accepted',last_error='',smtp_message_id=?,accepted_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(result.messageId,row.id);
    audit(row.id,'smtp.outbound_accepted',{message_id:result.messageId,reply:result.reply});
    return {delivery_claim:'outbound_accepted',outbound_state:'completed',message_id:result.messageId};
  }catch(error){
    const detail=String(error?.message||error).slice(0,500);
    db.prepare("UPDATE mail_outbox SET state='retry',last_error=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(detail,row.id);
    audit(row.id,'smtp.retry',{error:detail});
    throw error;
  }
}

let worker=false;
async function processPending(){
  if(worker||!smtpConfigured())return;
  worker=true;
  try{
    const rows=db.prepare("SELECT * FROM mail_outbox WHERE state IN ('queued','retry','awaiting_smtp') ORDER BY created_at LIMIT 10").all();
    for(const row of rows){try{await attempt(row)}catch{}}
  }finally{worker=false}
}
setInterval(()=>{processPending().catch(()=>{})},15000).unref();

const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/','http://'+(req.headers.host||'localhost'));
    if(url.pathname==='/healthz'&&req.method==='GET')return json(res,200,{ok:true,service:'IZAKHONO MAIL',version:'1.0.0'});
    if(url.pathname==='/readyz'&&req.method==='GET'){
      let database=false;try{database=db.prepare('SELECT 1 AS ok').get()?.ok===1}catch{}
      const ready=database&&Boolean(apiToken);
      return json(res,ready?200:503,{ok:ready,service:'IZAKHONO MAIL',database:database?'ready':'error',api_auth_configured:Boolean(apiToken),smtp_configured:smtpConfigured(),smtp_secure:smtpSecure,smtp_starttls:smtpStarttls});
    }
    if(!authorized(req))return json(res,401,{ok:false,error:'unauthorized'});

    if(url.pathname==='/v1/send'&&req.method==='POST'){
      const input=await readJson(req);
      const key=clean(input.idempotency_key,180);
      const to=input.to&&typeof input.to==='object'?input.to:{};
      const recipientEmail=email(to.email);
      const subject=clean(input.subject,500),body=clean(input.body_text,100000);
      if(!key||!recipientEmail||!recipientEmail.includes('@')||!subject||!body)return json(res,422,{ok:false,error:'idempotency_key_to_subject_body_required'});
      let row=db.prepare('SELECT * FROM mail_outbox WHERE idempotency_key=?').get(key);
      if(!row){
        const id=uid('mail');
        db.prepare('INSERT INTO mail_outbox(id,idempotency_key,recipient_name,recipient_email,subject,body_text,metadata_json,state) VALUES(?,?,?,?,?,?,?,?)')
          .run(id,key,clean(to.name,200),recipientEmail,subject,body,JSON.stringify(input.metadata&&typeof input.metadata==='object'?input.metadata:{}).slice(0,10000),'queued');
        audit(id,'mail.accepted',{recipient_email_sha256:crypto.createHash('sha256').update(recipientEmail).digest('hex')});
        row=db.prepare('SELECT * FROM mail_outbox WHERE id=?').get(id);
      }else if(row.state==='outbound_accepted'){
        return json(res,200,{ok:true,idempotent_replay:true,outbox:outboxView(row),delivery_claim:'outbound_accepted',outbound_state:'completed'});
      }
      try{
        const result=await attempt(row);
        row=db.prepare('SELECT * FROM mail_outbox WHERE id=?').get(row.id);
        return json(res,result.outbound_state==='completed'?200:202,{ok:true,idempotent_replay:false,outbox:outboxView(row),...result});
      }catch(error){
        row=db.prepare('SELECT * FROM mail_outbox WHERE id=?').get(row.id);
        return json(res,503,{ok:false,error:'smtp_dispatch_failed',detail:String(error?.message||error).slice(0,300),outbox:outboxView(row)});
      }
    }

    if(url.pathname==='/v1/outbox'&&req.method==='GET'){
      const rows=db.prepare('SELECT * FROM mail_outbox ORDER BY created_at DESC LIMIT 100').all();
      return json(res,200,{ok:true,outbox:rows.map(outboxView)});
    }
    if(url.pathname==='/v1/run-due'&&req.method==='POST'){
      await processPending();
      return json(res,200,{ok:true,counts:db.prepare('SELECT state,COUNT(*) AS count FROM mail_outbox GROUP BY state').all()});
    }
    return json(res,404,{ok:false,error:'not_found'});
  }catch(error){
    const m=String(error?.message||error);
    return json(res,m==='body_too_large'?413:m==='invalid_json'?400:500,{ok:false,error:m==='body_too_large'||m==='invalid_json'?m:'mail_error',detail:m.slice(0,300)});
  }
});
server.listen(port,host,()=>{
  console.log('[IZAKHONO MAIL] listening on http://'+host+':'+port);
  console.log('[IZAKHONO MAIL] smtp='+(smtpConfigured()?'configured':'awaiting-configuration'));
});
