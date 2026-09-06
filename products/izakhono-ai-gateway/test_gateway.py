#!/usr/bin/env python3
import importlib.util
import json
import os
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

os.environ["IZAKHONO_AI_GATEWAY_INTERNAL_KEY"] = "gateway-test"
os.environ["IZAKHONO_ACCESS_INTERNAL_KEY"] = "access-test"
os.environ["IZAKHONO_ACCESS_URL"] = "http://127.0.0.1:19494"
os.environ["IZAKHONO_OLLAMA_URL"] = "http://127.0.0.1:19134"

class AccessMock(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        n=int(self.headers.get("content-length","0")); data=json.loads(self.rfile.read(n))
        active = data.get("subject") != "inactive@example.com"
        body=json.dumps({"ok":True,"active":active}).encode()
        self.send_response(200); self.send_header("content-type","application/json"); self.send_header("content-length",str(len(body))); self.end_headers(); self.wfile.write(body)

class ModelMock(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        n=int(self.headers.get("content-length","0")); data=json.loads(self.rfile.read(n))
        body=json.dumps({"message":{"content":"mock-response"}}).encode()
        self.send_response(200); self.send_header("content-type","application/json"); self.send_header("content-length",str(len(body))); self.end_headers(); self.wfile.write(body)

a=ThreadingHTTPServer(("127.0.0.1",19494),AccessMock)
m=ThreadingHTTPServer(("127.0.0.1",19134),ModelMock)
threading.Thread(target=a.serve_forever,daemon=True).start()
threading.Thread(target=m.serve_forever,daemon=True).start()

spec=importlib.util.spec_from_file_location("gateway",Path(__file__).with_name("app.py"))
g=importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

assert g.check_access("faisready-entity","active@example.com","faisready")["active"] is True
assert g.check_access("faisready-entity","inactive@example.com","faisready")["active"] is False
assert g.model_chat([{"role":"user","content":"hello"}],"qwen3:4b")["message"]["content"]=="mock-response"

print("IZAKHONO_AI_GATEWAY_TEST=PASS")
a.shutdown(); m.shutdown()
