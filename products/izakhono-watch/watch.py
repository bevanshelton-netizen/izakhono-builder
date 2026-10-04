#!/usr/bin/env python3
import json, os, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT=int(os.getenv("IZAKHONO_WATCH_PORT","9595"))
TARGETS={
 "node":os.getenv("IZAKHONO_NODE_URL","http://127.0.0.1:9191")+"/healthz",
 "control":os.getenv("IZAKHONO_CONTROL_URL","http://127.0.0.1:9292")+"/healthz",
 "registry":os.getenv("IZAKHONO_REGISTRY_URL","http://127.0.0.1:9494")+"/healthz"
}

def probe(url):
    try:
        with urllib.request.urlopen(url,timeout=2) as r:
            return {"ok":200<=r.status<300,"status":r.status}
    except Exception as e:
        return {"ok":False,"error":type(e).__name__}

def snapshot():
    checks={k:probe(v) for k,v in TARGETS.items()}
    return {"service":"izakhono-watch","healthy":all(x["ok"] for x in checks.values()),"checks":checks}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body=json.dumps(snapshot()).encode()
        self.send_response(200 if self.path=="/healthz" and snapshot()["healthy"] else (503 if self.path=="/healthz" else 200))
        self.send_header("Content-Type","application/json"); self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self,*args): pass

if __name__=="__main__":
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
