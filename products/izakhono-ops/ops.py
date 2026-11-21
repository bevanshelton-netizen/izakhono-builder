#!/usr/bin/env python3
"""IZAKHONO OPS - dependency-light owner status surface."""

import json
import os
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

NODE = os.getenv("IZAKHONO_NODE_URL", "http://127.0.0.1:9191").rstrip("/")
CONTROL = os.getenv("IZAKHONO_CONTROL_URL", "http://127.0.0.1:9292").rstrip("/")
EVIDENCE = Path(os.getenv("IZAKHONO_EVIDENCE_DIR", "/var/lib/izakhono-node/evidence"))
PORT = int(os.getenv("IZAKHONO_OPS_PORT", "9393"))

def probe(url):
    try:
        with urllib.request.urlopen(url, timeout=2) as r:
            return {"ok": 200 <= r.status < 300, "status": r.status}
    except Exception as e:
        return {"ok": False, "error": type(e).__name__}

def snapshot():
    evidence = list(EVIDENCE.glob("*")) if EVIDENCE.exists() else []
    return {
        "service": "izakhono-ops",
        "time": datetime.now(timezone.utc).isoformat(),
        "node": probe(NODE + "/healthz"),
        "control": probe(CONTROL + "/healthz"),
        "evidence": {"path": str(EVIDENCE), "present": EVIDENCE.exists(), "items": len(evidence)},
        "policy": {
            "management_public": False,
            "deployment_authority": "IZAKHONO CONTROL",
            "execution_authority": "IZAKHONO NODE"
        }
    }

HTML = """<!doctype html><html><head><meta charset=utf-8><meta name=viewport content="width=device-width">
<title>IZAKHONO OPS</title><style>body{font-family:system-ui;margin:32px;background:#0b1020;color:#eef}
.card{padding:18px;margin:12px 0;border:1px solid #334;border-radius:12px;background:#121a30}
.ok{color:#6ee7b7}.bad{color:#fca5a5}code{opacity:.8}</style></head>
<body><h1>IZAKHONO OPS</h1><p>Owner control surface · read-only</p><div id=a>Loading…</div>
<script>async function go(){let r=await fetch('/api/status');let x=await r.json();
let c=(n,v)=>'<div class="card"><b>'+n+'</b><br><span class="'+(v.ok?'ok':'bad')+'">'+
(v.ok?'READY':'NOT READY')+'</span> <code>'+JSON.stringify(v)+'</code></div>';
a.innerHTML=c('NODE',x.node)+c('CONTROL',x.control)+
c('EVIDENCE',x.evidence)+c('POLICY',x.policy)}</script><script>go();setInterval(go,5000)</script></body></html>"""

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/healthz":
            body=b'{"ok":true,"service":"izakhono-ops"}'
            self.send_response(200)
            self.send_header("Content-Type","application/json")
        elif self.path == "/api/status":
            body=json.dumps(snapshot()).encode()
            self.send_response(200)
            self.send_header("Content-Type","application/json")
        elif self.path == "/":
            body=HTML.encode()
            self.send_response(200)
            self.send_header("Content-Type","text/html; charset=utf-8")
        else:
            self.send_response(404); body=b"not found"; self.send_header("Content-Type","text/plain")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def log_message(self, *_): pass

if __name__ == "__main__":
    print(f"IZAKHONO OPS listening on 127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
