#!/usr/bin/env python3
import hashlib,hmac,json,os,queue,secrets,subprocess,threading,time
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path

HOST=os.getenv('IZAKHONO_NODE_HOST','127.0.0.1')
PORT=int(os.getenv('IZAKHONO_NODE_PORT','9191'))
SECRET=os.getenv('IZAKHONO_NODE_SECRET','')
ROOT=Path(os.getenv('IZAKHONO_NODE_ROOT','/var/lib/izakhono-node'))
DEPLOYER=os.getenv('IZAKHONO_NODE_DEPLOYER','/opt/izakhono-node/deploy.sh')
MAX_SKEW=300
jobs={}
nonces={}
q=queue.Queue()
ROOT.mkdir(parents=True,exist_ok=True)

def clean_nonces():
    cutoff=time.time()-MAX_SKEW
    for n,t in list(nonces.items()):
        if t<cutoff: nonces.pop(n,None)

def verify(headers,body):
    if not SECRET: return False,'node secret not configured'
    ts=headers.get('X-IZAKHONO-Timestamp','')
    nonce=headers.get('X-IZAKHONO-Nonce','')
    sig=headers.get('X-IZAKHONO-Signature','')
    try: stamp=int(ts)
    except: return False,'bad timestamp'
    if abs(int(time.time())-stamp)>MAX_SKEW: return False,'expired request'
    clean_nonces()
    if not nonce or nonce in nonces: return False,'replayed request'
    expected=hmac.new(SECRET.encode(),f'{ts}.{nonce}.'.encode()+body,hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected,sig): return False,'bad signature'
    nonces[nonce]=time.time()
    return True,''

def valid_job(j):
    mode=str(j.get('mode') or 'single')
    if mode not in ('single','compose'): return False,'invalid mode'

    required=['app','repo','ref']
    if any(not j.get(k) for k in required): return False,'missing required field'
    if not str(j['app']).replace('-','').replace('_','').isalnum(): return False,'invalid app'
    if not str(j['repo']).startswith(('https://','ssh://','git@')): return False,'invalid repo'

    if mode=='single':
        if not j.get('container_port') or not j.get('health_path'): return False,'missing single-service field'
        if not str(j['health_path']).startswith('/'): return False,'invalid health path'
        try:
            port=int(j['container_port'])
            if port<1 or port>65535: return False,'invalid container port'
        except Exception:
            return False,'invalid container port'
    else:
        if not j.get('compose_file') or not j.get('health_url'): return False,'missing compose-service field'
        health=str(j['health_url'])
        if not health.startswith(('http://127.0.0.1:','http://localhost:','https://127.0.0.1:','https://localhost:')):
            return False,'compose health_url must be localhost'

    env=str(j.get('env_file',''))
    if env and not Path(env).resolve().as_posix().startswith('/etc/izakhono/apps/'):
        return False,'env_file must live under /etc/izakhono/apps'
    return True,''

def worker():
    while True:
        jid,j=q.get(); jobs[jid]['status']='running'; jobs[jid]['started_at']=int(time.time())
        cmd=[DEPLOYER,json.dumps(j,separators=(',',':'))]
        p=subprocess.run(cmd,text=True,capture_output=True)
        jobs[jid].update(status='succeeded' if p.returncode==0 else 'failed',finished_at=int(time.time()),returncode=p.returncode,output=(p.stdout+p.stderr)[-12000:])
        (ROOT/'jobs').mkdir(exist_ok=True)
        (ROOT/'jobs'/f'{jid}.json').write_text(json.dumps(jobs[jid],indent=2))
        q.task_done()
threading.Thread(target=worker,daemon=True).start()

class H(BaseHTTPRequestHandler):
    def sendj(self,code,obj):
        data=json.dumps(obj,separators=(',',':')).encode(); self.send_response(code); self.send_header('Content-Type','application/json'); self.send_header('Content-Length',str(len(data))); self.end_headers(); self.wfile.write(data)
    def log_message(self,*a): pass
    def do_GET(self):
        if self.path=='/healthz': return self.sendj(200,{'ok':True,'service':'izakhono-node','version':'0.1.0'})
        if self.path=='/v1/status': return self.sendj(200,{'ok':True,'queued':q.qsize(),'jobs':list(jobs.values())[-20:]})
        if self.path.startswith('/v1/jobs/'):
            jid=self.path.rsplit('/',1)[-1]; return self.sendj(200,jobs[jid]) if jid in jobs else self.sendj(404,{'error':'not_found'})
        self.sendj(404,{'error':'not_found'})
    def do_POST(self):
        if self.path!='/v1/jobs': return self.sendj(404,{'error':'not_found'})
        body=self.rfile.read(min(int(self.headers.get('Content-Length','0')),65536))
        ok,err=verify(self.headers,body)
        if not ok: return self.sendj(401,{'error':err})
        try: j=json.loads(body)
        except: return self.sendj(400,{'error':'invalid_json'})
        ok,err=valid_job(j)
        if not ok: return self.sendj(400,{'error':err})
        jid=f"job_{int(time.time())}_{secrets.token_hex(6)}"; jobs[jid]={'id':jid,'app':j['app'],'ref':j['ref'],'status':'queued','created_at':int(time.time())}; q.put((jid,j)); self.sendj(202,jobs[jid])

if __name__=='__main__':
    print(f'IZAKHONO Node listening on {HOST}:{PORT}')
    ThreadingHTTPServer((HOST,PORT),H).serve_forever()
