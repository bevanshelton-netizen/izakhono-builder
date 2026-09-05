#!/usr/bin/env python3
import importlib.util
import json
import os
import tempfile
import threading
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TMP = tempfile.TemporaryDirectory()
os.environ['IZAKHONO_WORK_HOST'] = '127.0.0.1'
os.environ['IZAKHONO_WORK_PORT'] = '19393'
os.environ['IZAKHONO_OLLAMA_URL'] = 'http://127.0.0.1:19134'
os.environ['IZAKHONO_WORK_DATA'] = TMP.name
os.environ['IZAKHONO_WORK_TOKEN'] = ''

class MockModel(BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def out(self, obj):
        b=json.dumps(obj).encode(); self.send_response(200); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def do_GET(self): self.out({'models':[{'name':'qwen3:4b'}]})
    def do_POST(self):
        n=int(self.headers.get('Content-Length','0')); d=json.loads(self.rfile.read(n)); self.out({'message':{'content':'mock:'+d['messages'][-1]['content']}})

def request(path, payload=None):
    body=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request('http://127.0.0.1:19393'+path,data=body,headers={'Content-Type':'application/json'},method='POST' if body else 'GET')
    with urllib.request.urlopen(req, timeout=3) as r: return json.loads(r.read())

mock=ThreadingHTTPServer(('127.0.0.1',19134), MockModel)
threading.Thread(target=mock.serve_forever, daemon=True).start()
spec=importlib.util.spec_from_file_location('izakhono_work', os.path.join(os.path.dirname(__file__),'app.py'))
appmod=importlib.util.module_from_spec(spec); spec.loader.exec_module(appmod)
app=ThreadingHTTPServer(('127.0.0.1',19393), appmod.Handler)
threading.Thread(target=app.serve_forever, daemon=True).start()
try:
    health=request('/healthz'); assert health['ok'] is True and health['model_backend']=='online'
    c=request('/api/conversations',{}); assert c['id']
    chat=request('/api/chat',{'conversation_id':c['id'],'message':'owner test'}); assert chat['answer']=='mock:owner test'
    saved=request('/api/conversations/'+c['id']); assert len(saved['messages'])==2
    print('IZAKHONO_WORK_SMOKE=PASS')
finally:
    app.shutdown(); mock.shutdown(); TMP.cleanup()
