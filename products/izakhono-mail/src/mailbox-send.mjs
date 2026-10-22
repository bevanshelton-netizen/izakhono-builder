import http from 'node:http';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const host = process.env.MAILBOX_SEND_HOST || '127.0.0.1';
const port = Number(process.env.MAILBOX_SEND_PORT || 9898);
const dbPath = process.env.IZAKHONO_MAIL_CORE_DB || '/app/data/mail-core.sqlite';
const relayUrl = process.env.IZAKHONO_MAIL_RELAY_URL || 'http://127.0.0.1:9899/v1/send';
const apiToken = process.env.MAILBOX_SEND_API_TOKEN || '';
const sender = (process.env.IZAKHONO_MAIL_SENDER || 'bevan@izakhono').toLowerCase();

const db = new DatabaseSync(dbPath);
db.exec(`
CREATE TABLE IF NOT EXISTS mail_identities (
  address TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  quota_bytes INTEGER NOT NULL DEFAULT 1073741824,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS mail_messages (
  id TEXT PRIMARY KEY,
  mailbox_address TEXT NOT NULL,
  folder TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_addresses TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  raw_headers TEXT NOT NULL DEFAULT '',
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  unread INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_mail_messages_mailbox_folder ON mail_messages(mailbox_address,folder,received_at DESC);
`);

db.prepare('INSERT OR IGNORE INTO mail_identities(address,display_name) VALUES(?,?)').run(sender, 'Bevan Shelton');

const clean = (v, n = 100000) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const email = v => clean(v, 320).toLowerCase();
const uid = () => 'msg_' + crypto.randomUUID().replaceAll('-', '');

function json(res, status, body) {
  const raw = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {'content-type':'application/json; charset=utf-8','content-length':raw.length,'cache-control':'no-store'});
  res.end(raw);
}
function authorized(req) {
  if (!apiToken) return true;
  const supplied = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  return supplied === apiToken;
}
async function readJson(req) {
  const chunks=[]; let size=0;
  for await (const chunk of req) { size += chunk.length; if (size > 512*1024) throw new Error('body_too_large'); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('invalid_json'); }
}
function localSentMessage({id,to,subject,body}) {
  db.prepare(`INSERT INTO mail_messages
    (id,mailbox_address,folder,from_address,to_addresses,subject,body_text,raw_headers,unread)
    VALUES(?,?,?,?,?,?,?,?,0)`)
    .run(id, sender, 'SENT', sender, JSON.stringify([to]), subject, body, 'X-IZAKHONO-Origin: mailbox-send');
}
function postRelay(payload) {
  return new Promise((resolve,reject) => {
    const target = new URL(relayUrl);
    const data = Buffer.from(JSON.stringify(payload));
    const req = http.request({hostname:target.hostname,port:target.port||80,path:target.pathname+target.search,method:'POST',headers:{'content-type':'application/json','content-length':data.length,...(process.env.MAIL_RELAY_TOKEN ? {'authorization':'Bearer '+process.env.MAIL_RELAY_TOKEN}: {})}}, res => {
      const chunks=[];
      res.on('data', c=>chunks.push(c));
      res.on('end', ()=>{ let body={}; try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{}; if(res.statusCode>=200&&res.statusCode<300) resolve(body); else reject(new Error(body.detail||body.error||`relay_http_${res.statusCode}`)); });
    });
    req.on('error',reject); req.end(data);
  });
}

const server=http.createServer(async (req,res)=>{
  try {
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(url.pathname==='/healthz'&&req.method==='GET') return json(res,200,{ok:true,service:'IZAKHONO MAILBOX SEND',sender,relay_url:relayUrl});
    if(!authorized(req)) return json(res,401,{ok:false,error:'unauthorized'});
    if(url.pathname==='/v1/mailbox/send'&&req.method==='POST') {
      const input=await readJson(req);
      const to=email(input.to), subject=clean(input.subject,500), body=clean(input.body_text,100000);
      if(!to.includes('@')||!subject||!body) return json(res,422,{ok:false,error:'to_subject_body_required'});
      const id=uid();
      localSentMessage({id,to,subject,body});
      try {
        const relay=await postRelay({idempotency_key:id,to:{email:to,name:clean(input.to_name,200)},subject,body_text:body,metadata:{source:'izakhono-mailbox',message_id:id}});
        return json(res,200,{ok:true,message_id:id,folder:'SENT',delivery:relay});
      } catch(error) {
        return json(res,202,{ok:true,message_id:id,folder:'SENT',delivery:{state:'queued_or_retry',detail:String(error.message||error).slice(0,300)}});
      }
    }
    return json(res,404,{ok:false,error:'not_found'});
  } catch(error) {
    const message=String(error.message||error);
    return json(res,message==='body_too_large'?413:500,{ok:false,error:message});
  }
});
server.listen(port,host,()=>console.log(`[IZAKHONO MAILBOX SEND] listening on http://${host}:${port}`));
