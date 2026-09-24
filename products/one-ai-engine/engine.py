#!/usr/bin/env python3
"""IZAKHONO ONE AI Engine v1.

Owned inference control plane. Models are interchangeable workers; the engine,
routing contract and policy remain IZAKHONO-owned.
"""
import json
import os
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST=os.getenv("ONE_AI_ENGINE_HOST","127.0.0.1")
PORT=int(os.getenv("ONE_AI_ENGINE_PORT","9696"))
WORKERS=[x.strip().rstrip("/") for x in os.getenv("ONE_AI_WORKERS","http://127.0.0.1:11434").split(",") if x.strip()]
DEFAULT_MODEL=os.getenv("ONE_AI_MODEL","qwen3:4b")
MAX_BODY=1_000_000

def request_json(url,payload,timeout=300):
    data=json.dumps(payload).encode()
    req=urllib.request.Request(url,data=data,headers={"content-type":"application/json"},method="POST")
    with urllib.request.urlopen(req,timeout=timeout) as res:
        return json.loads(res.read().decode())

def infer(messages,model=None):
    errors=[]
    for worker in WORKERS:
        started=time.monotonic()
        try:
            result=request_json(worker+"/api/chat",{"model":model or DEFAULT_MODEL,"stream":False,"messages":messages})
            answer=str(result.get("message",{}).get("content","")).strip()
            if answer:
                return {"message":{"content":answer},"model":model or DEFAULT_MODEL,"engine":"one-ai","worker_ms":round((time.monotonic()-started)*1000)}
            errors.append("empty_response")
        except Exception as exc:
            errors.append(type(exc).__name__)
    raise RuntimeError("all_owned_workers_unavailable:"+",".join(errors))

def send(h,status,obj):
    body=json.dumps(obj,separators=(",",":")).encode()
    h.send_response(status); h.send_header("content-type","application/json; charset=utf-8")
    h.send_header("content-length",str(len(body))); h.send_header("cache-control","no-store")
    h.end_headers(); h.wfile.write(body)

class Handler(BaseHTTPRequestHandler):
    server_version="IzakhonoOneAIEngine/1.0"
    def log_message(self,fmt,*args): pass
    def do_GET(self):
        if self.path.split("?")[0]=="/healthz":
            return send(self,200,{"ok":True,"engine":"one-ai","version":"1","worker_count":len(WORKERS),"default_model":DEFAULT_MODEL,"telemetry":False})
        return send(self,404,{"ok":False,"error":"not_found"})
    def do_POST(self):
        if self.path.split("?")[0]!="/api/v1/infer": return send(self,404,{"ok":False,"error":"not_found"})
        try:
            n=int(self.headers.get("content-length","0"))
            if n<=0 or n>MAX_BODY: raise ValueError()
            p=json.loads(self.rfile.read(n))
            messages=p.get("messages")
            if not isinstance(messages,list) or not messages: return send(self,422,{"ok":False,"error":"messages_required"})
            return send(self,200,{"ok":True,**infer(messages,p.get("model"))})
        except Exception as exc:
            return send(self,502,{"ok":False,"error":"inference_unavailable","detail":str(exc)[:160]})

if __name__=="__main__":
    print(f"IZAKHONO ONE AI ENGINE listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
