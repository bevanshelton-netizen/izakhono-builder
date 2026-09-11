#!/usr/bin/env python3
import hashlib
import hmac
import ipaddress
import json
import os
import socket
import sqlite3
import time
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST=os.getenv("IZAKHONO_RUNNER_HOST","127.0.0.1")
PORT=int(os.getenv("IZAKHONO_RUNNER_PORT","9992"))
SECRET=os.getenv("IZAKHONO_RUNNER_SECRET","")
DB_PATH=Path(os.getenv("IZAKHONO_RUNNER_DB","./izakhono-runner.db"))
ALLOW_PRIVATE=os.getenv("IZAKHONO_RUNNER_ALLOW_PRIVATE","false").lower()=="true"
MAX_SKEW=300
MAX_BODY=1024*1024
FETCH_LIMIT=2*1024*1024
USER_AGENT="IZAKHONO-RUNNER/1.0"

DB_PATH.parent.mkdir(parents=True,exist_ok=True)

SCHEMA="""
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS watch_state(
  entity_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  target TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status_code INTEGER,
  seen_at INTEGER NOT NULL,
  preview TEXT,
  PRIMARY KEY(entity_id,task_id,target)
);
"""

def db():
    c=sqlite3.connect(DB_PATH,timeout=30)
    c.row_factory=sqlite3.Row
    return c

with db() as c:
    c.executescript(SCHEMA)

def now_ts():
    return int(time.time())

def verify(headers,body):
    if not SECRET:
        return False,"runner secret not configured"
    ts=headers.get("X-IZAKHONO-Timestamp","")
    sig=headers.get("X-IZAKHONO-Signature","")
    try:
        stamp=int(ts)
    except Exception:
        return False,"bad timestamp"
    if abs(now_ts()-stamp)>MAX_SKEW:
        return False,"expired request"
    expected=hmac.new(SECRET.encode(),ts.encode()+b"."+body,hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected,sig):
        return False,"bad signature"
    return True,""

def public_target(url):
    p=urllib.parse.urlparse(url)
    if p.scheme not in ("http","https") or not p.hostname:
        raise ValueError("target must be http or https")
    try:
        infos=socket.getaddrinfo(p.hostname,p.port or (443 if p.scheme=="https" else 80),type=socket.SOCK_STREAM)
    except Exception as e:
        raise ValueError("target DNS lookup failed") from e
    for info in infos:
        ip=ipaddress.ip_address(info[4][0])
        if (ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast or ip.is_reserved) and not ALLOW_PRIVATE:
            raise ValueError("private or local target blocked")
    return url

def fetch(url):
    public_target(url)
    req=urllib.request.Request(url,headers={"User-Agent":USER_AGENT,"Accept":"*/*"},method="GET")
    try:
        with urllib.request.urlopen(req,timeout=20) as r:
            raw=r.read(FETCH_LIMIT+1)
            if len(raw)>FETCH_LIMIT:
                raw=raw[:FETCH_LIMIT]
            ct=r.headers.get("Content-Type","")
            status=r.status
    except urllib.error.HTTPError as e:
        raw=e.read(min(FETCH_LIMIT,256*1024))
        ct=e.headers.get("Content-Type","")
        status=e.code
    text=raw.decode("utf-8","replace")
    normalized="\n".join(line.rstrip() for line in text.replace("\r\n","\n").split("\n")).strip()
    digest=hashlib.sha256(normalized.encode()).hexdigest()
    preview=normalized[:1200]
    return {"status":status,"content_type":ct,"hash":digest,"preview":preview,"bytes":len(raw)}

def get_spec(task):
    spec=task.get("runner_spec")
    if isinstance(spec,dict):
        return spec
    instruction=str(task.get("instruction",""))
    prefix="RUNNER_SPEC:"
    for line in instruction.splitlines():
        if line.strip().startswith(prefix):
            raw=line.strip()[len(prefix):].strip()
            try:
                return json.loads(raw)
            except Exception:
                raise ValueError("invalid RUNNER_SPEC json")
    return {"type":"instruction"}

def state_get(entity,task_id,target):
    with db() as c:
        return c.execute("SELECT * FROM watch_state WHERE entity_id=? AND task_id=? AND target=?",(entity,task_id,target)).fetchone()

def state_put(entity,task_id,target,result):
    with db() as c:
        c.execute("""INSERT INTO watch_state(entity_id,task_id,target,content_hash,status_code,seen_at,preview)
                     VALUES(?,?,?,?,?,?,?)
                     ON CONFLICT(entity_id,task_id,target) DO UPDATE SET
                       content_hash=excluded.content_hash,
                       status_code=excluded.status_code,
                       seen_at=excluded.seen_at,
                       preview=excluded.preview""",
                  (entity,task_id,target,result["hash"],result["status"],now_ts(),result["preview"]))

def execute(task):
    spec=get_spec(task)
    typ=str(spec.get("type","instruction"))

    if typ=="instruction":
        return {
            "output":"Task received by IZAKHONO RUNNER. No external connector was specified.",
            "notify":task.get("task_mode")!="condition_watch"
        }

    if typ in ("website_watch","json_watch","http_watch"):
        target=str(spec.get("url","")).strip()
        if not target:
            raise ValueError("watch url required")
        result=fetch(target)
        previous=state_get(str(task["entity_id"]),str(task["id"]),target)
        changed=previous is None or previous["content_hash"]!=result["hash"] or previous["status_code"]!=result["status"]
        state_put(str(task["entity_id"]),str(task["id"]),target,result)
        if previous is None:
            output=f"Baseline recorded for {target}. HTTP {result['status']}."
            notify=False if task.get("task_mode")=="condition_watch" else True
        elif changed:
            output=f"Change detected for {target}. HTTP {previous['status_code']} -> {result['status']}. Preview: {result['preview'][:700]}"
            notify=True
        else:
            output=f"No meaningful content change for {target}. HTTP {result['status']}."
            notify=False
        return {"output":output,"notify":notify,"changed":changed,"status":result["status"]}

    if typ=="github_public_watch":
        repo=str(spec.get("repo","")).strip()
        endpoint=str(spec.get("endpoint","commits")).strip()
        if "/" not in repo or repo.count("/")!=1:
            raise ValueError("repo must be owner/name")
        allowed={"commits","pulls","issues","releases/latest"}
        if endpoint not in allowed:
            raise ValueError("unsupported GitHub endpoint")
        target=f"https://api.github.com/repos/{repo}/{endpoint}"
        result=fetch(target)
        previous=state_get(str(task["entity_id"]),str(task["id"]),target)
        changed=previous is None or previous["content_hash"]!=result["hash"]
        state_put(str(task["entity_id"]),str(task["id"]),target,result)
        if previous is None:
            return {"output":f"GitHub baseline recorded for {repo}/{endpoint}.","notify":False,"changed":False}
        return {
            "output":(f"GitHub change detected for {repo}/{endpoint}." if changed else f"No GitHub change for {repo}/{endpoint}."),
            "notify":bool(changed),
            "changed":bool(changed)
        }

    raise ValueError("unsupported runner_spec type")

class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass

    def sendj(self,code,obj):
        b=json.dumps(obj,separators=(",",":")).encode()
        self.send_response(code)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def do_GET(self):
        if self.path=="/healthz":
            return self.sendj(200,{
                "ok":True,
                "service":"izakhono-runner",
                "version":"1.0.0",
                "capabilities":["website_watch","json_watch","http_watch","github_public_watch"],
                "allow_private_targets":ALLOW_PRIVATE
            })
        self.sendj(404,{"error":"not_found"})

    def do_POST(self):
        if self.path!="/v1/run":
            return self.sendj(404,{"error":"not_found"})
        n=min(int(self.headers.get("Content-Length","0") or 0),MAX_BODY)
        body=self.rfile.read(n)
        ok,err=verify(self.headers,body)
        if not ok:
            return self.sendj(401,{"error":err})
        try:
            payload=json.loads(body or b"{}")
            task=payload.get("task") or {}
            for k in ("id","entity_id","title","instruction","task_mode"):
                if k not in task:
                    raise ValueError(f"missing task.{k}")
            result=execute(task)
            return self.sendj(200,{"ok":True,**result})
        except ValueError as e:
            return self.sendj(400,{"error":str(e)})
        except Exception as e:
            return self.sendj(500,{"error":"runner_execution_failed","detail":str(e)[:300]})

def serve():
    if not SECRET:
        raise RuntimeError("IZAKHONO_RUNNER_SECRET is required")
    print(f"IZAKHONO RUNNER listening on {HOST}:{PORT}")
    ThreadingHTTPServer((HOST,PORT),H).serve_forever()

if __name__=="__main__":
    serve()
