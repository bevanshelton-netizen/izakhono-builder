#!/usr/bin/env python3
"""Minimal local IZAKHONO Registry service."""

import json, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT=int(os.getenv("IZAKHONO_REGISTRY_PORT","9494"))
REGISTRY=Path(os.getenv("IZAKHONO_REGISTRY_FILE","registry.example.json"))

def load():
    try:
        return json.loads(REGISTRY.read_text())
    except Exception:
        return {"schema":"izakhono.registry/v1","updatedAt":None,"platforms":[],"nodes":[]}

class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path=="/healthz":
            body=b'{"ok":true,"service":"izakhono-registry"}'
            self.send_response(200); self.send_header("Content-Type","application/json")
        elif self.path=="/api/registry":
            body=json.dumps(load()).encode()
            self.send_response(200); self.send_header("Content-Type","application/json")
        else:
            body=b"not found"; self.send_response(404); self.send_header("Content-Type","text/plain")
        self.send_header("Content-Length",str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self,*args): pass

if __name__=="__main__":
    ThreadingHTTPServer(("127.0.0.1",PORT),Handler).serve_forever()
