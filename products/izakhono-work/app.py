#!/usr/bin/env python3
import hmac
import io
import json
import mimetypes
import os
import sqlite3
import sys
import time
import zipfile
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
from builder_core import BuilderEngine, BuilderError, WorkspaceManager, safe_slug

HOST = os.getenv("IZAKHONO_WORK_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_WORK_PORT", "9393"))
TOKEN = os.getenv("IZAKHONO_WORK_TOKEN", "")
OLLAMA_URL = os.getenv("IZAKHONO_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("IZAKHONO_WORK_MODEL", "qwen3:4b")
BUILDER_MODEL = os.getenv("IZAKHONO_WORK_BUILDER_MODEL", DEFAULT_MODEL)
DATA_DIR = Path(os.getenv("IZAKHONO_WORK_DATA", "/var/lib/izakhono-work"))
DB_PATH = DATA_DIR / "work.db"
WORKSPACE = WorkspaceManager(DATA_DIR)
MAX_BODY = 1_000_000
MAX_CONTEXT_MESSAGES = 40

SYSTEM_PROMPT = os.getenv(
    "IZAKHONO_WORK_SYSTEM_PROMPT",
    "You are IZAKHONO WORK, an owner-controlled AI assistant. Be practical, concise, accurate, and explicit about uncertainty. Never claim an external action succeeded unless there is evidence that it did."
)

HTML = r'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><title>IZAKHONO WORK</title>
<style>
:root{--bg:#070806;--panel:#10120f;--line:#2b3027;--gold:#d8b24f;--green:#55d88a;--text:#f6f4ea;--muted:#a7ac9f;--danger:#ff8b8b}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top,#151910,#070806 52%);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;height:100vh;overflow:hidden}.app{height:100%;display:grid;grid-template-columns:300px 1fr}.side{border-right:1px solid var(--line);background:#0a0c09dd;padding:20px;display:flex;flex-direction:column;gap:16px}.brand{font-weight:900;letter-spacing:.11em}.brand span{color:var(--gold)}.pill{display:inline-flex;gap:7px;align-items:center;font-size:12px;color:var(--muted)}.dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 12px #55d88a88}.new{border:1px solid #5f512b;background:linear-gradient(180deg,#282112,#19150c);color:var(--text);padding:12px 14px;border-radius:12px;font-weight:700;cursor:pointer}.threads{overflow:auto;display:flex;flex-direction:column;gap:8px}.thread{padding:10px 11px;border-radius:10px;color:var(--muted);cursor:pointer;border:1px solid transparent}.thread.active,.thread:hover{background:#151811;color:var(--text);border-color:#303629}.small{font-size:12px;color:var(--muted)}.main{display:flex;flex-direction:column;min-width:0}.top{padding:16px 20px;border-bottom:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;background:#090b08cc}.status{font-size:12px;color:var(--muted)}.messages{flex:1;overflow:auto;padding:28px max(18px,calc((100% - 850px)/2));display:flex;flex-direction:column;gap:16px}.bubble{max-width:88%;padding:14px 16px;border-radius:16px;white-space:pre-wrap;line-height:1.45;word-break:break-word}.assistant{background:#131611;border:1px solid #252a22;align-self:flex-start}.user{background:#2a2412;border:1px solid #5e512c;align-self:flex-end}.empty{margin:auto;text-align:center;max-width:610px}.empty h1{font-size:clamp(32px,6vw,60px);margin:0 0 12px;letter-spacing:-.04em}.empty h1 span{color:var(--gold)}.empty p{color:var(--muted);line-height:1.6}.composer-wrap{padding:14px max(14px,calc((100% - 850px)/2)) 20px;background:linear-gradient(0deg,#080a07 68%,transparent)}.composer{border:1px solid #343a30;background:#11140f;border-radius:18px;padding:10px;display:flex;gap:10px;align-items:flex-end;box-shadow:0 10px 50px #0008}.composer textarea{flex:1;resize:none;min-height:48px;max-height:170px;background:transparent;border:0;outline:0;color:var(--text);font:inherit;padding:10px}.send{width:44px;height:44px;border-radius:50%;border:0;background:var(--gold);font-weight:900;cursor:pointer}.tools{display:flex;gap:8px;align-items:center}.tool{border:1px solid #343a30;background:#0b0d0a;color:var(--muted);padding:8px 10px;border-radius:10px;cursor:pointer}.banner{display:none;padding:10px 14px;background:#321919;color:#ffd7d7;border-bottom:1px solid #6e3333;font-size:13px}.token{margin-top:auto}.token input{width:100%;margin-top:6px;border:1px solid var(--line);background:#0f110e;color:var(--text);padding:9px;border-radius:9px}.file-chip{display:inline-block;margin:3px;padding:5px 8px;border:1px solid #4a503f;border-radius:999px;color:var(--muted);font-size:12px}@media(max-width:760px){.app{grid-template-columns:1fr}.side{display:none}.messages{padding:20px 14px}.top{padding:14px}.bubble{max-width:94%}.composer-wrap{padding:10px 10px 14px}.status strong{display:none}}
</style></head><body><div class="app"><aside class="side"><div><div class="brand">IZAKHONO <span>WORK</span></div><div class="pill"><i class="dot"></i> Owner AI workspace</div></div><button class="new" id="newChat">+ New conversation</button><div class="threads" id="threads"></div><div class="token"><div class="small">Owner token (only if enabled)</div><input id="token" type="password" placeholder="Stored on this device"></div><div class="small">Local-first. No usage-credit gate.<br>Capacity depends on your own hardware.</div></aside><main class="main"><div class="top"><div><strong id="title">New conversation</strong><div class="status" id="runtime">Checking local model...</div></div><div class="pill"><i class="dot"></i><strong>OWNER MODE</strong></div></div><div class="banner" id="banner"></div><div class="messages" id="messages"><div class="empty" id="empty"><h1>Your work. <span>Your compute.</span></h1><p>This workspace talks to the model running on your IZAKHONO owner node. There is no per-message Work credit counter. Your real limits are the laptop/server resources you own.</p></div></div><div class="composer-wrap"><div id="files"></div><div class="composer"><div class="tools"><label class="tool" title="Attach text/code file">＋<input id="file" type="file" multiple hidden></label></div><textarea id="input" placeholder="Ask IZAKHONO WORK anything..."></textarea><button class="send" id="send">➤</button></div></div></main></div>
<script>
const S={id:null,attachments:[]}; const $=id=>document.getElementById(id);
function headers(){const h={'Content-Type':'application/json'};const t=$('token').value.trim();if(t)h['Authorization']='Bearer '+t;return h}
async function api(path,opts={}){opts.headers={...(opts.headers||{}),...headers()};const r=await fetch(path,opts);let j={};try{j=await r.json()}catch{}if(!r.ok)throw new Error(j.detail||j.error||('HTTP '+r.status));return j}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function banner(msg){$('banner').textContent=msg;$('banner').style.display=msg?'block':'none'}
function bubble(role,text){$('empty')?.remove();const d=document.createElement('div');d.className='bubble '+(role==='user'?'user':'assistant');d.textContent=text;$('messages').appendChild(d);$('messages').scrollTop=$('messages').scrollHeight}
async function refresh(){try{const s=await api('/api/status');const ready=s.backend==='online'&&s.model_installed!==false;$('runtime').textContent=`${ready?'Local model ready':(s.backend==='online'?'Model not installed':'Model backend offline')} • ${s.model}`;banner(ready?'':(s.backend==='online'?`Configured model ${s.model} is not installed on this owner node yet.`:`Local model backend is offline. Start Ollama on the owner node.`))}catch(e){banner(e.message)}try{const d=await api('/api/conversations');$('threads').innerHTML=d.items.map(x=>`<div class="thread ${x.id===S.id?'active':''}" data-id="${x.id}">${esc(x.title||'Conversation')}</div>`).join('');document.querySelectorAll('.thread').forEach(el=>el.onclick=()=>load(el.dataset.id))}catch(e){}}
async function newChat(){const d=await api('/api/conversations',{method:'POST',body:JSON.stringify({})});S.id=d.id;$('messages').innerHTML='<div class="empty" id="empty"><h1>Your work. <span>Your compute.</span></h1><p>Start a new owner-controlled conversation.</p></div>';$('title').textContent='New conversation';await refresh()}
async function load(id){S.id=id;const d=await api('/api/conversations/'+id);$('title').textContent=d.title;$('messages').innerHTML='';if(!d.messages.length)$('messages').innerHTML='<div class="empty" id="empty"><h1>Your work. <span>Your compute.</span></h1></div>';d.messages.forEach(m=>bubble(m.role,m.content));await refresh()}
function filesPrompt(){if(!S.attachments.length)return '';return '\n\nAttached local files:\n'+S.attachments.map(f=>`\n--- ${f.name} ---\n${f.text}`).join('\n')}
async function send(){let text=$('input').value.trim();if(!text)return;if(!S.id)await newChat();const display=text+(S.attachments.length?`\n\n[${S.attachments.length} local file(s) attached]`:'');bubble('user',display);$('input').value='';$('send').disabled=true;banner('');try{const d=await api('/api/chat',{method:'POST',body:JSON.stringify({conversation_id:S.id,message:text+filesPrompt()})});bubble('assistant',d.answer);$('title').textContent=d.title;S.attachments=[];$('files').innerHTML='';await refresh()}catch(e){bubble('assistant','Request failed: '+e.message);banner(e.message)}finally{$('send').disabled=false;$('input').focus()}}
$('send').onclick=send;$('newChat').onclick=()=>newChat().catch(e=>banner(e.message));$('input').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}});$('token').value=localStorage.getItem('izakhonoWorkToken')||'';$('token').onchange=()=>{localStorage.setItem('izakhonoWorkToken',$('token').value);refresh()};$('file').onchange=async e=>{S.attachments=[];for(const f of [...e.target.files].slice(0,5)){let t=await f.text();S.attachments.push({name:f.name,text:t.slice(0,120000)})}$('files').innerHTML=S.attachments.map(f=>`<span class="file-chip">${esc(f.name)}</span>`).join('')};refresh();
</script></body></html>'''


def db_connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("CREATE TABLE IF NOT EXISTS conversations (id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)")
    db.execute("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, conversation_id TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE)")
    db.commit()
    return db


def json_request(url, payload=None, timeout=180):
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST" if body is not None else "GET")
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())


def backend_status():
    try:
        data = json_request(OLLAMA_URL + "/api/tags", timeout=3)
        models = [m.get("name", "") for m in data.get("models", [])]
        return True, models
    except Exception:
        return False, []


def conversation_messages(db, cid):
    rows = db.execute("SELECT role,content FROM messages WHERE conversation_id=? ORDER BY id ASC", (cid,)).fetchall()
    return [{"role": r["role"], "content": r["content"]} for r in rows]


def title_for(message):
    compact = " ".join(message.strip().split())
    return (compact[:57] + "…") if len(compact) > 58 else (compact or "Conversation")


class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoWork/0.2"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def _send(self, code, body, content_type="application/json; charset=utf-8"):
        data = body if isinstance(body, bytes) else body.encode()
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(data)

    def out(self, code, obj):
        self._send(code, json.dumps(obj, separators=(",", ":")))

    def authed(self):
        if not TOKEN:
            return True
        return hmac.compare_digest(self.headers.get("Authorization", ""), f"Bearer {TOKEN}")

    def body_json(self):
        try:
            n = int(self.headers.get("Content-Length", "0"))
            if n <= 0 or n > MAX_BODY:
                raise ValueError("invalid_body_size")
            return json.loads(self.rfile.read(n))
        except Exception as e:
            raise ValueError("invalid_json") from e

    def do_GET(self):
        p = urlparse(self.path).path
        if p in ("/", "/index.html"):
            return self._send(200, HTML, "text/html; charset=utf-8")
        if p == "/healthz":
            online, _ = backend_status()
            return self.out(200, {"ok": True, "service": "izakhono-work", "version": "0.1.0", "model_backend": "online" if online else "offline"})
        if not self.authed():
            return self.out(401, {"error": "unauthorized"})
        if p == "/api/status":
            online, models = backend_status()
            installed = DEFAULT_MODEL in models or any(m.split(":")[0] == DEFAULT_MODEL.split(":")[0] and m.endswith(DEFAULT_MODEL.split(":")[-1]) for m in models)
            return self.out(200, {"ok": True, "backend": "online" if online else "offline", "model": DEFAULT_MODEL, "model_installed": installed, "installed_models": models, "usage_credit_gate": False})
        if p == "/api/conversations":
            with db_connect() as db:
                rows = db.execute("SELECT id,title,created_at,updated_at FROM conversations ORDER BY updated_at DESC LIMIT 100").fetchall()
                return self.out(200, {"items": [dict(r) for r in rows]})
        if p.startswith("/api/conversations/"):
            cid = p.rsplit("/", 1)[-1]
            with db_connect() as db:
                row = db.execute("SELECT id,title,created_at,updated_at FROM conversations WHERE id=?", (cid,)).fetchone()
                if not row:
                    return self.out(404, {"error": "conversation_not_found"})
                return self.out(200, {**dict(row), "messages": conversation_messages(db, cid)})
        return self.out(404, {"error": "not_found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if not self.authed():
            return self.out(401, {"error": "unauthorized"})
        if p == "/api/conversations":
            cid = uuid.uuid4().hex
            now = int(time.time())
            with db_connect() as db:
                db.execute("INSERT INTO conversations(id,title,created_at,updated_at) VALUES(?,?,?,?)", (cid, "New conversation", now, now))
                db.commit()
            return self.out(201, {"id": cid, "title": "New conversation"})
        if p == "/api/chat":
            try:
                data = self.body_json()
            except ValueError as e:
                return self.out(400, {"error": str(e)})
            cid = str(data.get("conversation_id", ""))
            message = str(data.get("message", "")).strip()
            model = str(data.get("model", DEFAULT_MODEL)).strip() or DEFAULT_MODEL
            if not cid or not message:
                return self.out(400, {"error": "conversation_id_and_message_required"})
            if len(message) > 500_000:
                return self.out(413, {"error": "message_too_large"})
            with db_connect() as db:
                row = db.execute("SELECT title FROM conversations WHERE id=?", (cid,)).fetchone()
                if not row:
                    return self.out(404, {"error": "conversation_not_found"})
                now = int(time.time())
                db.execute("INSERT INTO messages(conversation_id,role,content,created_at) VALUES(?,?,?,?)", (cid, "user", message, now))
                if row["title"] == "New conversation":
                    db.execute("UPDATE conversations SET title=?,updated_at=? WHERE id=?", (title_for(message), now, cid))
                else:
                    db.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, cid))
                db.commit()
                history = conversation_messages(db, cid)[-MAX_CONTEXT_MESSAGES:]
            payload = {"model": model, "stream": False, "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + history}
            try:
                result = json_request(OLLAMA_URL + "/api/chat", payload, timeout=300)
                answer = str(result.get("message", {}).get("content", "")).strip()
                if not answer:
                    raise RuntimeError("model_returned_empty_answer")
            except urllib.error.HTTPError as e:
                detail_raw = e.read().decode(errors="replace")[:400]
                detail = detail_raw
                try:
                    parsed = json.loads(detail_raw)
                    detail = str(parsed.get("error") or detail_raw)
                except Exception:
                    pass
                return self.out(502, {"error": "model_backend_error", "detail": detail})
            except Exception as e:
                return self.out(502, {"error": "model_backend_unreachable", "detail": str(e)[:300]})
            with db_connect() as db:
                now = int(time.time())
                db.execute("INSERT INTO messages(conversation_id,role,content,created_at) VALUES(?,?,?,?)", (cid, "assistant", answer, now))
                db.execute("UPDATE conversations SET updated_at=? WHERE id=?", (now, cid))
                db.commit()
                title = db.execute("SELECT title FROM conversations WHERE id=?", (cid,)).fetchone()["title"]
            return self.out(200, {"answer": answer, "title": title, "model": model})
        return self.out(404, {"error": "not_found"})


if __name__ == "__main__":
    db_connect().close()
    print(f"IZAKHONO WORK listening on http://{HOST}:{PORT} using {OLLAMA_URL} model={DEFAULT_MODEL}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
