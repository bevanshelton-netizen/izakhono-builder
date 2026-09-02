#!/usr/bin/env python3
import hashlib,hmac,json,os,secrets,time,urllib.request
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer

HOST=os.getenv('IZAKHONO_CONTROL_HOST','127.0.0.1')
PORT=int(os.getenv('IZAKHONO_CONTROL_PORT','9292'))
TOKEN=os.getenv('IZAKHONO_CONTROL_TOKEN','')
NODE=os.getenv('IZAKHONO_NODE_URL','http://127.0.0.1:9191')
NODE_SECRET=os.getenv('IZAKHONO_NODE_SECRET','')

def send_node(job):
    body=json.dumps(job,separators=(',',':')).encode()
    ts=str(int(time.time())); nonce=secrets.token_hex(16)
    sig=hmac.new(NODE_SECRET.encode(),f'{ts}.{nonce}.'.encode()+body,hashlib.sha256).hexdigest()
    req=urllib.request.Request(NODE.rstrip('/')+'/v1/jobs',data=body,method='POST',headers={
        'Content-Type':'application/json','X-IZAKHONO-Timestamp':ts,'X-IZAKHONO-Nonce':nonce,'X-IZAKHONO-Signature':sig})
    with urllib.request.urlopen(req,timeout=20) as r: return r.status,json.loads(r.read())

class H(BaseHTTPRequestHandler):
    def log_message(self,*a): pass
    def out(self,code,obj):
        b=json.dumps(obj,separators=(',',':')).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(b))); self.end_headers(); self.wfile.write(b)
    def authed(self):
        return bool(TOKEN) and hmac.compare_digest(self.headers.get('Authorization',''),f'Bearer {TOKEN}')
    def do_GET(self):
        if self.path=='/healthz': return self.out(200,{'ok':True,'service':'izakhono-control','version':'0.1.0'})
        self.out(404,{'error':'not_found'})
    def do_POST(self):
        if self.path!='/v1/deploy': return self.out(404,{'error':'not_found'})
        if not self.authed(): return self.out(401,{'error':'unauthorized'})
        try:
            n=min(int(self.headers.get('Content-Length','0')),65536); job=json.loads(self.rfile.read(n))
        except Exception: return self.out(400,{'error':'invalid_json'})
        try: status,payload=send_node(job); return self.out(status,payload)
        except Exception as e: return self.out(502,{'error':'node_unreachable','detail':str(e)[:300]})

if __name__=='__main__':
    if not TOKEN or not NODE_SECRET: raise SystemExit('IZAKHONO_CONTROL_TOKEN and IZAKHONO_NODE_SECRET are required')
    print(f'IZAKHONO Control listening on {HOST}:{PORT}')
    ThreadingHTTPServer((HOST,PORT),H).serve_forever()
