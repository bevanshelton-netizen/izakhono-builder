#!/usr/bin/env python3
import ast
import json
import math
import operator
import os
import sqlite3
import urllib.request
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_INTELLIGENCE_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_INTELLIGENCE_PORT", "9797"))
DATA_DIR = Path(os.getenv("IZAKHONO_INTELLIGENCE_DATA", "./data"))
DB_PATH = DATA_DIR / "intelligence.db"
ID_URL = os.getenv("IZAKHONO_ID_URL", "http://127.0.0.1:9696").rstrip("/")
ID_INTERNAL_KEY = os.getenv("IZAKHONO_ID_INTERNAL_KEY", "")
AI_URL = os.getenv("IZAKHONO_AI_GATEWAY_URL", "http://127.0.0.1:9595").rstrip("/")
AI_INTERNAL_KEY = os.getenv("IZAKHONO_AI_GATEWAY_INTERNAL_KEY", "")
MAX_BODY = 1_000_000
MAX_CONTEXT = 50

HTML = r'''<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IZAKHONO INTELLIGENCE 10</title>
<style>
:root{--bg:#070806;--panel:#10120f;--line:#2c3027;--gold:#d9b24c;--green:#54d887;--text:#f7f5ea;--muted:#9fa696}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 50% -20%,#1c2115,#070806 48%);color:var(--text);font:15px/1.5 Inter,system-ui,sans-serif;height:100vh}
.app{height:100%;display:grid;grid-template-columns:280px 1fr}.side{border-right:1px solid var(--line);padding:22px;background:#090b08e8;display:flex;flex-direction:column;gap:18px}
.brand{font-size:17px;font-weight:900;letter-spacing:.08em}.brand span{color:var(--gold)}.version{font-size:11px;color:var(--green);margin-top:3px}
button{font:inherit}.new{padding:12px;border-radius:12px;border:1px solid #5c512c;background:#211b0d;color:var(--text);font-weight:800;cursor:pointer}
.threads{overflow:auto;display:flex;flex-direction:column;gap:7px}.thread{padding:10px;border-radius:10px;color:var(--muted);border:1px solid transparent;cursor:pointer}.thread:hover,.thread.active{background:#151811;border-color:#303629;color:var(--text)}
.footer{margin-top:auto;color:var(--muted);font-size:12px}.main{display:flex;flex-direction:column;min-width:0}.top{padding:16px 22px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center}
.status{font-size:12px;color:var(--muted)}.badge{border:1px solid #2f583d;border-radius:999px;padding:6px 10px;color:var(--green);font-size:11px;font-weight:800}
.messages{flex:1;overflow:auto;padding:28px max(16px,calc((100% - 860px)/2));display:flex;flex-direction:column;gap:15px}.bubble{white-space:pre-wrap;max-width:88%;padding:14px 16px;border-radius:16px;word-break:break-word}.assistant{align-self:flex-start;background:#121510;border:1px solid #252b21}.user{align-self:flex-end;background:#2a2311;border:1px solid #5b4e2a}
.hero{margin:auto;text-align:center;max-width:680px}.hero h1{font-size:clamp(34px,6vw,64px);letter-spacing:-.05em;margin:0}.hero h1 span{color:var(--gold)}.hero p{color:var(--muted);font-size:16px}
.composer-wrap{padding:12px max(12px,calc((100% - 860px)/2)) 20px}.composer{display:flex;gap:10px;border:1px solid #343a30;background:#11140f;border-radius:18px;padding:10px}.composer textarea{flex:1;min-height:48px;max-height:180px;resize:none;background:transparent;border:0;outline:0;color:var(--text);padding:10px;font:inherit}.send{width:46px;height:46px;border:0;border-radius:50%;background:var(--gold);font-weight:900;cursor:pointer}
.login{display:flex;gap:8px;align-items:center}.login input{background:#0d100c;border:1px solid var(--line);border-radius:9px;padding:8px;color:var(--text);width:210px}.error{display:none;background:#351818;color:#ffd2d2;padding:10px 18px;border-bottom:1px solid #623131}
@media(max-width:760px){.app{grid-template-columns:1fr}.side{display:none}.top{padding:13px}.messages{padding:18px 12px}.bubble{max-width:94%}.login input{width:135px}.top strong{display:none}}
</style></head>
<body><div class="app"><aside class="side"><div><div class="brand">IZAKHONO <span>INTELLIGENCE</span></div><div class="version">10 • OWNER AI PLATFORM</div></div><button class="new" id="newChat">+ New conversation</button><div class="threads" id="threads"></div><div class="footer">Entity-isolated • Subscriber-aware<br>No artificial message-credit meter</div></aside>
<main class="main"><div class="top"><div><strong id="title">IZAKHONO Intelligence</strong><div class="status" id="status">Connect your entity session</div></div><div class="login"><input id="token" type="password" placeholder="IZAKHONO ID session token"><span class="badge">INTELLIGENCE 10</span></div></div><div class="error" id="error"></div><div class="messages" id="messages"><div class="hero" id="hero"><h1>One intelligence. <span>Owned by IZAKHONO.</span></h1><p>Entity-aware AI, persistent conversations, subscriber access and replaceable model backends—without tying the business to a single AI vendor.</p></div></div><div class="composer-wrap"><div class="composer"><textarea id="input" placeholder="Ask IZAKHONO Intelligence..."></textarea><button class="send" id="send">➤</button></div></div></main></div>
<script>
const S={id:null}; const $=x=>document.getElementById(x);
function headers(){const h={'content-type':'application/json'};const t=$('token').value.trim();if(t)h.authorization='Bearer '+t;return h}
async function api(path,opts={}){opts.headers={...(opts.headers||{}),...headers()};const r=await fetch(path,opts);let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.error||('HTTP '+r.status));return j}
function showError(m){$('error').textContent=m||'';$('error').style.display=m?'block':'none'}
function bubble(role,text){$('hero')?.remove();const d=document.createElement('div');d.className='bubble '+(role==='user'?'user':'assistant');d.textContent=text;$('messages').appendChild(d);$('messages').scrollTop=$('messages').scrollHeight}
async function me(){try{const x=await api('/api/v1/me');$('status').textContent=x.entity.slug+' • '+x.subject;showError('');await refresh()}catch(e){$('status').textContent='Session required';showError(e.message)}}
async function refresh(){try{const x=await api('/api/v1/conversations');$('threads').innerHTML=x.items.map(c=>'<div class="thread '+(c.id===S.id?'active':'')+'" data-id="'+c.id+'">'+c.title.replace(/[<>&]/g,'')+'</div>').join('');document.querySelectorAll('.thread').forEach(e=>e.onclick=()=>load(e.dataset.id))}catch{}}
async function newChat(){const x=await api('/api/v1/conversations',{method:'POST',body:JSON.stringify({product:'faisready'})});S.id=x.id;$('messages').innerHTML='<div class="hero" id="hero"><h1>New <span>conversation.</span></h1></div>';$('title').textContent=x.title;await refresh()}
async function load(id){S.id=id;const x=await api('/api/v1/conversations/'+id);$('title').textContent=x.title;$('messages').innerHTML='';x.messages.forEach(m=>bubble(m.role,m.content));await refresh()}
async function send(){const text=$('input').value.trim();if(!text)return;if(!S.id)await newChat();bubble('user',text);$('input').value='';$('send').disabled=true;showError('');try{const x=await api('/api/v1/chat',{method:'POST',body:JSON.stringify({conversation_id:S.id,message:text})});bubble('assistant',x.answer);$('title').textContent=x.title;await refresh()}catch(e){showError(e.message);bubble('assistant','Request failed: '+e.message)}finally{$('send').disabled=false}}
$('send').onclick=send;$('newChat').onclick=()=>newChat().catch(e=>showError(e.message));$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};$('token').value=localStorage.getItem('izakhonoIdSession')||'';$('token').onchange=()=>{localStorage.setItem('izakhonoIdSession',$('token').value);me()};if($('token').value)me();
</script></body></html>'''

def db_connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db=sqlite3.connect(DB_PATH)
    db.row_factory=sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS conversations(
      id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, subject TEXT NOT NULL, product_slug TEXT NOT NULL,
      title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL,
      content TEXT NOT NULL, created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    )""")
    db.commit()
    return db

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def http_json(url,payload=None,headers=None,timeout=120):
    body=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(url,data=body,headers={"content-type":"application/json",**(headers or {})},method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req,timeout=timeout) as res:
        return json.loads(res.read().decode())

def introspect(token):
    if not ID_INTERNAL_KEY:
        raise RuntimeError("identity_internal_key_missing")
    return http_json(ID_URL+"/api/v1/internal/introspect",{"token":token},{"x-izakhono-id-internal-key":ID_INTERNAL_KEY},timeout=10)

def ai_chat(entity_id,subject,product,messages):
    if not AI_INTERNAL_KEY:
        raise RuntimeError("ai_gateway_key_missing")
    return http_json(AI_URL+"/api/v1/chat",{
        "entity_id":entity_id,
        "subject":subject,
        "product":product,
        "messages":messages
    },{"x-izakhono-ai-key":AI_INTERNAL_KEY},timeout=300)

def title_for(text):
    compact=" ".join(str(text).split())
    return compact[:58]+("…" if len(compact)>58 else "") or "Conversation"

OPS={ast.Add:operator.add,ast.Sub:operator.sub,ast.Mult:operator.mul,ast.Div:operator.truediv,ast.FloorDiv:operator.floordiv,ast.Mod:operator.mod,ast.Pow:operator.pow,ast.USub:operator.neg,ast.UAdd:operator.pos}

def safe_calculate(expression):
    node=ast.parse(str(expression),mode="eval")
    def walk(n):
        if isinstance(n,ast.Expression): return walk(n.body)
        if isinstance(n,ast.Constant) and isinstance(n.value,(int,float)): return n.value
        if isinstance(n,ast.UnaryOp) and type(n.op) in OPS: return OPS[type(n.op)](walk(n.operand))
        if isinstance(n,ast.BinOp) and type(n.op) in OPS:
            left,right=walk(n.left),walk(n.right)
            if isinstance(n.op,ast.Pow) and abs(right)>10: raise ValueError("power_too_large")
            out=OPS[type(n.op)](left,right)
            if not math.isfinite(float(out)) or abs(float(out))>1e100: raise ValueError("result_out_of_range")
            return out
        raise ValueError("unsupported_expression")
    return walk(node)

def bearer(handler):
    value=handler.headers.get("authorization","")
    return value[7:].strip() if value.lower().startswith("bearer ") else ""

def send_json(handler,status,obj):
    body=json.dumps(obj,separators=(",",":")).encode()
    handler.send_response(status);handler.send_header("content-type","application/json; charset=utf-8");handler.send_header("content-length",str(len(body)));handler.send_header("cache-control","no-store");handler.send_header("x-content-type-options","nosniff");handler.end_headers();handler.wfile.write(body)

class Handler(BaseHTTPRequestHandler):
    server_version="IzakhonoIntelligence/10"
    def log_message(self,fmt,*args): print(f"{self.client_address[0]} - {fmt % args}")
    def read_json(self):
        n=int(self.headers.get("content-length","0") or "0")
        if n<=0 or n>MAX_BODY: raise ValueError("invalid_body_size")
        return json.loads(self.rfile.read(n).decode())
    def identity(self):
        token=bearer(self)
        if not token: return None
        result=introspect(token)
        return result if result.get("active") else None
    def do_GET(self):
        p=urlparse(self.path).path
        if p in ("/","/index.html"):
            raw=HTML.encode();self.send_response(200);self.send_header("content-type","text/html; charset=utf-8");self.send_header("content-length",str(len(raw)));self.send_header("cache-control","no-store");self.end_headers();self.wfile.write(raw);return
        if p=="/healthz":
            return send_json(self,200,{"ok":True,"service":"izakhono-intelligence","version":"10","entity_isolation":True,"usage_credit_gate":False})
        try: identity=self.identity()
        except Exception as exc: return send_json(self,503,{"ok":False,"error":"identity_service_unavailable","detail":str(exc)[:160]})
        if not identity: return send_json(self,401,{"ok":False,"error":"invalid_session"})
        if p=="/api/v1/me":
            return send_json(self,200,{"ok":True,"subject":identity["subject"],"entity":{"id":identity["entity_id"],"slug":identity["entity_slug"]},"role":identity["role"]})
        if p=="/api/v1/capabilities":
            return send_json(self,200,{"ok":True,"version":"10","capabilities":["persistent_chat","entity_identity","subscriber_ai","calculator","replaceable_models"],"planned":["web_research","files","voice","vision","code_execution","apps","agents","memory","image_generation"]})
        if p=="/api/v1/conversations":
            with db_connect() as db:
                rows=db.execute("SELECT id,title,product_slug,created_at,updated_at FROM conversations WHERE entity_id=? AND subject=? ORDER BY updated_at DESC LIMIT 100",(identity["entity_id"],identity["subject"])).fetchall()
            return send_json(self,200,{"ok":True,"items":[dict(r) for r in rows]})
        if p.startswith("/api/v1/conversations/"):
            cid=p.rsplit("/",1)[-1]
            with db_connect() as db:
                conv=db.execute("SELECT * FROM conversations WHERE id=? AND entity_id=? AND subject=?",(cid,identity["entity_id"],identity["subject"])).fetchone()
                if not conv:return send_json(self,404,{"ok":False,"error":"conversation_not_found"})
                msgs=db.execute("SELECT role,content,created_at FROM messages WHERE conversation_id=? ORDER BY id",(cid,)).fetchall()
            return send_json(self,200,{"ok":True,**dict(conv),"messages":[dict(m) for m in msgs]})
        return send_json(self,404,{"ok":False,"error":"not_found"})
    def do_POST(self):
        p=urlparse(self.path).path
        try: identity=self.identity()
        except Exception as exc: return send_json(self,503,{"ok":False,"error":"identity_service_unavailable","detail":str(exc)[:160]})
        if not identity: return send_json(self,401,{"ok":False,"error":"invalid_session"})
        try:data=self.read_json()
        except Exception:return send_json(self,400,{"ok":False,"error":"invalid_json"})
        if p=="/api/v1/conversations":
            product=str(data.get("product") or "").strip().lower()
            if not product:return send_json(self,422,{"ok":False,"error":"product_required"})
            cid="con_"+uuid.uuid4().hex;ts=now_iso()
            with db_connect() as db:
                db.execute("INSERT INTO conversations(id,entity_id,subject,product_slug,title,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",(cid,identity["entity_id"],identity["subject"],product,"New conversation",ts,ts));db.commit()
            return send_json(self,201,{"ok":True,"id":cid,"title":"New conversation","product":product})
        if p=="/api/v1/tools/calculator":
            try:result=safe_calculate(data.get("expression"))
            except Exception as exc:return send_json(self,422,{"ok":False,"error":str(exc)})
            return send_json(self,200,{"ok":True,"result":result})
        if p=="/api/v1/chat":
            cid=str(data.get("conversation_id") or "");message=str(data.get("message") or "").strip()
            if not cid or not message:return send_json(self,422,{"ok":False,"error":"conversation_id_and_message_required"})
            with db_connect() as db:
                conv=db.execute("SELECT * FROM conversations WHERE id=? AND entity_id=? AND subject=?",(cid,identity["entity_id"],identity["subject"])).fetchone()
                if not conv:return send_json(self,404,{"ok":False,"error":"conversation_not_found"})
                ts=now_iso();db.execute("INSERT INTO messages(conversation_id,role,content,created_at) VALUES(?,?,?,?)",(cid,"user",message,ts))
                if conv["title"]=="New conversation":db.execute("UPDATE conversations SET title=?,updated_at=? WHERE id=?",(title_for(message),ts,cid))
                else:db.execute("UPDATE conversations SET updated_at=? WHERE id=?",(ts,cid))
                db.commit();rows=db.execute("SELECT role,content FROM messages WHERE conversation_id=? ORDER BY id DESC LIMIT ?",(cid,MAX_CONTEXT)).fetchall()
                history=[dict(r) for r in reversed(rows)]
            system={"role":"system","content":"You are IZAKHONO Intelligence 10, an entity-aware assistant running behind IZAKHONO-owned platform contracts. Be accurate, useful and explicit about uncertainty. Never claim external actions occurred unless evidence is available."}
            try:out=ai_chat(identity["entity_id"],identity["subject"],conv["product_slug"],[system]+history)
            except urllib.error.HTTPError as exc:
                detail=exc.read().decode(errors="replace")[:240]
                return send_json(self,502,{"ok":False,"error":"ai_gateway_error","detail":detail})
            except Exception as exc:return send_json(self,502,{"ok":False,"error":"ai_gateway_unavailable","detail":str(exc)[:180]})
            answer=str(out.get("answer") or "").strip()
            if not answer:return send_json(self,502,{"ok":False,"error":"empty_ai_response"})
            with db_connect() as db:
                ts=now_iso();db.execute("INSERT INTO messages(conversation_id,role,content,created_at) VALUES(?,?,?,?)",(cid,"assistant",answer,ts));db.execute("UPDATE conversations SET updated_at=? WHERE id=?",(ts,cid));db.commit();title=db.execute("SELECT title FROM conversations WHERE id=?",(cid,)).fetchone()["title"]
            return send_json(self,200,{"ok":True,"answer":answer,"title":title,"identity":{"entity_id":identity["entity_id"],"subject":identity["subject"]},"subscription":out.get("subscription",{})})
        return send_json(self,404,{"ok":False,"error":"not_found"})

if __name__=="__main__":
    db_connect().close()
    print(f"IZAKHONO INTELLIGENCE 10 listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
