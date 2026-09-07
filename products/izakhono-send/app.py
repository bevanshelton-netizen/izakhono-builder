#!/usr/bin/env python3
import hashlib,hmac,json,mimetypes,os,re,secrets,shutil,sqlite3,threading,time,urllib.parse,webbrowser
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path

VERSION="1.0.0"
HOST=os.getenv("IZAKHONO_SEND_HOST","127.0.0.1")
PORT=int(os.getenv("IZAKHONO_SEND_PORT","8787"))
PUBLIC_BASE=os.getenv("IZAKHONO_SEND_PUBLIC_BASE","").rstrip("/")
MAX_FILE_BYTES=int(os.getenv("IZAKHONO_SEND_MAX_FILE_BYTES",str(5*1024*1024*1024)))
MAX_TRANSFER_BYTES=int(os.getenv("IZAKHONO_SEND_MAX_TRANSFER_BYTES",str(20*1024*1024*1024)))
DEFAULT_EXPIRY_HOURS=int(os.getenv("IZAKHONO_SEND_DEFAULT_EXPIRY_HOURS","168"))
MAX_EXPIRY_HOURS=int(os.getenv("IZAKHONO_SEND_MAX_EXPIRY_HOURS","720"))

if os.name=="nt":
    ROOT=Path(os.getenv("IZAKHONO_SEND_ROOT",str(Path(os.getenv("LOCALAPPDATA",str(Path.home())))/"IzakhonoSend"))).resolve()
else:
    ROOT=Path(os.getenv("IZAKHONO_SEND_ROOT","/var/lib/izakhono-send")).resolve()
OBJECTS=ROOT/"objects";DB_PATH=ROOT/"send.db";TOKEN_FILE=ROOT/"admin-token.txt"

def ts(): return int(time.time())
def ensure_root():
    ROOT.mkdir(parents=True,exist_ok=True);OBJECTS.mkdir(parents=True,exist_ok=True)

def load_admin_token():
    env=os.getenv("IZAKHONO_SEND_ADMIN_TOKEN","").strip()
    if env:return env
    ensure_root()
    if TOKEN_FILE.exists():return TOKEN_FILE.read_text(encoding="utf-8").strip()
    token=secrets.token_urlsafe(32);TOKEN_FILE.write_text(token+"\n",encoding="utf-8")
    try:os.chmod(TOKEN_FILE,0o600)
    except OSError:pass
    return token
ADMIN_TOKEN=load_admin_token()

def db():
    con=sqlite3.connect(DB_PATH,timeout=30);con.row_factory=sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL");con.execute("PRAGMA foreign_keys=ON")
    return con

def init_db():
    ensure_root()
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS transfers(
          id TEXT PRIMARY KEY,entity_id TEXT NOT NULL,title TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',
          secret_hash TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL,
          max_downloads INTEGER,download_count INTEGER NOT NULL DEFAULT 0,total_bytes INTEGER NOT NULL DEFAULT 0,
          file_count INTEGER NOT NULL DEFAULT 0,purged_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS files(
          id TEXT PRIMARY KEY,transfer_id TEXT NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
          display_name TEXT NOT NULL,stored_name TEXT NOT NULL,size_bytes INTEGER NOT NULL,sha256 TEXT NOT NULL,
          content_type TEXT NOT NULL,created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_send_files_transfer ON files(transfer_id);
        CREATE INDEX IF NOT EXISTS idx_send_transfer_entity ON transfers(entity_id,created_at DESC);
        """)

def clean_name(name):
    name=(name or "file").replace("\\","/").split("/")[-1].strip()
    name=re.sub(r"[\x00-\x1f\x7f]","",name)
    return name[:220] or "file"

def secret_hash(value):return hashlib.sha256(value.encode()).hexdigest()
def same(a,b):return bool(a) and hmac.compare_digest(a,b)
def transfer_dir(tid):return OBJECTS/tid

def row_transfer(tid):
    with db() as con:return con.execute("SELECT * FROM transfers WHERE id=?",(tid,)).fetchone()

def share_check(tid,secret):
    row=row_transfer(tid)
    if not row or not same(secret_hash(secret),row["secret_hash"]):return None,"not_found"
    if row["purged_at"] or row["expires_at"]<=ts():return row,"expired"
    if row["max_downloads"] is not None and row["download_count"]>=row["max_downloads"]:return row,"download_limit_reached"
    return row,None

def purge():
    stamp=ts()
    with db() as con:
        rows=con.execute("SELECT id FROM transfers WHERE expires_at<=? AND purged_at IS NULL",(stamp,)).fetchall()
        for r in rows:
            shutil.rmtree(transfer_dir(r["id"]),ignore_errors=True)
            con.execute("UPDATE transfers SET purged_at=? WHERE id=?",(stamp,r["id"]))

def cleaner():
    while True:
        try:purge()
        except Exception:pass
        time.sleep(900)

HOME="""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>IZAKHONO SEND</title><style>
body{margin:0;background:#07110c;color:#f6f4ed;font-family:Arial,sans-serif}.w{max-width:850px;margin:auto;padding:24px}
h1{color:#d6ad43}.c{background:#101d16;border:1px solid #284333;border-radius:18px;padding:20px;margin:16px 0}
label{display:block;color:#aab7ae;margin-top:12px;font-size:13px}input,textarea,select{width:100%;padding:12px;border-radius:10px;border:1px solid #284333;background:#09130e;color:white;box-sizing:border-box}
button{margin-top:16px;border:0;border-radius:10px;padding:13px 18px;font-weight:bold;background:#d6ad43;cursor:pointer}.share{color:#f3d36b;word-break:break-all}.muted{color:#aab7ae}
</style></head><body><div class="w"><h1>IZAKHONO SEND</h1><div class="muted">Owner-controlled secure file transfer</div>
<div class="c"><label>Entity ID</label><input id="entity" value="izakhono-africa"><label>Title</label><input id="title" value="IZAKHONO Transfer">
<label>Message</label><textarea id="note"></textarea><label>Expires</label><select id="exp"><option value="24">24 hours</option><option value="72">3 days</option><option value="168" selected>7 days</option><option value="336">14 days</option><option value="720">30 days</option></select>
<label>Maximum download starts (optional)</label><input id="maxd" type="number" min="1"><label>Select files</label><input id="files" type="file" multiple>
<label>Owner token</label><input id="owner" type="password"><button id="go">Create transfer</button><div id="status" class="muted"></div></div>
<div class="c" id="result" style="display:none"><b>Share this link</b><div id="share" class="share"></div><button id="copy">Copy link</button></div>
</div><script>
function el(x){return document.getElementById(x)}
var params=new URLSearchParams(location.hash.slice(1));if(params.get("owner")){sessionStorage.setItem("iz_owner",params.get("owner"));history.replaceState(null,"",location.pathname)}
el("owner").value=sessionStorage.getItem("iz_owner")||"";el("owner").oninput=function(){sessionStorage.setItem("iz_owner",el("owner").value)}
async function req(url,opt){var r=await fetch(url,opt||{}),j={};try{j=await r.json()}catch(e){}if(!r.ok)throw new Error(j.error||("HTTP "+r.status));return j}
el("go").onclick=async function(){var token=el("owner").value.trim(),files=Array.from(el("files").files);if(!token){alert("Enter the owner token");return}if(!files.length){alert("Select at least one file");return}
el("go").disabled=true;try{el("status").textContent="Creating transfer...";var body={entity_id:el("entity").value.trim(),title:el("title").value.trim(),note:el("note").value,expires_hours:Number(el("exp").value),max_downloads:el("maxd").value?Number(el("maxd").value):null};
var t=await req("/api/v1/transfers",{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+token},body:JSON.stringify(body)});
for(var i=0;i<files.length;i++){var f=files[i];el("status").textContent="Uploading "+(i+1)+"/"+files.length+": "+f.name;await req("/api/v1/transfers/"+encodeURIComponent(t.id)+"/files",{method:"PUT",headers:{"Authorization":"Bearer "+token,"X-Filename":encodeURIComponent(f.name),"Content-Type":f.type||"application/octet-stream"},body:f})}
el("share").textContent=t.share_url;el("result").style.display="block";el("status").textContent="Transfer ready."}catch(e){el("status").textContent="Error: "+e.message}finally{el("go").disabled=false}}
el("copy").onclick=async function(){await navigator.clipboard.writeText(el("share").textContent);el("copy").textContent="Copied"}
</script></body></html>"""

PUBLIC="""<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>IZAKHONO SEND</title>
<style>body{margin:0;background:#07110c;color:#f6f4ed;font-family:Arial,sans-serif}.w{max-width:760px;margin:auto;padding:24px}.c{background:#101d16;border:1px solid #284333;border-radius:18px;padding:20px;margin-top:18px}.gold{color:#d6ad43}.muted{color:#aab7ae}.f{padding:14px 0;border-top:1px solid #284333}.btn{display:inline-block;background:#d6ad43;color:#151006;padding:9px 12px;border-radius:9px;text-decoration:none;font-weight:bold}</style></head>
<body><div class="w"><h2 class="gold">IZAKHONO SEND</h2><div class="c" id="a">Loading transfer...</div></div><script>
function size(n){var u=["B","KB","MB","GB","TB"],i=0,x=n;while(x>=1024&&i<u.length-1){x/=1024;i++}return x.toFixed(i?1:0)+" "+u[i]}
var p=location.pathname.split("/").filter(Boolean),id=p[1],secret=p[2],a=document.getElementById("a");
fetch("/api/v1/public/"+encodeURIComponent(id)+"/"+encodeURIComponent(secret)).then(async function(r){var j={};try{j=await r.json()}catch(e){}if(!r.ok){a.innerHTML="<h2>Transfer unavailable</h2><div class=muted>"+(j.error||"Unavailable")+"</div>";return}
var s="<h2>"+j.title+"</h2><div class=muted>"+(j.note||"")+"</div><div class=muted>Expires "+new Date(j.expires_at*1000).toLocaleString()+"</div>";
for(var i=0;i<j.files.length;i++){var f=j.files[i];s+="<div class=f><b>"+f.name+"</b> <span class=muted>("+size(f.size_bytes)+")</span><br><a class=btn href=/d/"+encodeURIComponent(id)+"/"+encodeURIComponent(secret)+"/"+encodeURIComponent(f.id)+">Download</a></div>"}a.innerHTML=s})
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    server_version="IZAKHONO-SEND/"+VERSION
    def log_message(self,fmt,*args):print(self.client_address[0]+" - "+fmt%args)
    def headers_common(self):
        self.send_header("X-Content-Type-Options","nosniff");self.send_header("Referrer-Policy","no-referrer");self.send_header("Cache-Control","no-store")
    def out(self,code,data,ctype="application/json; charset=utf-8"):
        if not isinstance(data,bytes):data=json.dumps(data,separators=(",",":"),ensure_ascii=False).encode()
        self.send_response(code);self.send_header("Content-Type",ctype);self.send_header("Content-Length",str(len(data)));self.headers_common();self.end_headers()
        if self.command!="HEAD":self.wfile.write(data)
    def authed(self):return same(self.headers.get("Authorization",""),"Bearer "+ADMIN_TOKEN)
    def base(self):
        if PUBLIC_BASE:return PUBLIC_BASE
        scheme="https" if self.headers.get("X-Forwarded-Proto")=="https" else "http"
        return scheme+"://"+self.headers.get("Host","127.0.0.1:"+str(PORT))
    def json_body(self,limit=65536):
        n=int(self.headers.get("Content-Length","0"))
        if n<0 or n>limit:raise ValueError("request_too_large")
        return json.loads(self.rfile.read(n) or b"{}")
    def do_GET(self):
        path=urllib.parse.urlparse(self.path).path
        if path=="/healthz":return self.out(200,{"ok":True,"service":"izakhono-send","version":VERSION,"storage":"owner-filesystem"})
        if path=="/":return self.out(200,HOME.encode(),"text/html; charset=utf-8")
        if path.startswith("/t/"):return self.out(200,PUBLIC.encode(),"text/html; charset=utf-8")
        if path.startswith("/api/v1/public/"):return self.public_meta(path)
        if path.startswith("/d/"):return self.download(path)
        if path=="/api/v1/transfers":
            if not self.authed():return self.out(401,{"error":"unauthorized"})
            q=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query);entity=(q.get("entity_id") or [""])[0].strip()
            if not entity:return self.out(400,{"error":"entity_id_required"})
            with db() as con:rows=con.execute("SELECT id,entity_id,title,created_at,expires_at,file_count,total_bytes,download_count,max_downloads FROM transfers WHERE entity_id=? ORDER BY created_at DESC LIMIT 100",(entity,)).fetchall()
            return self.out(200,{"transfers":[dict(r) for r in rows]})
        return self.out(404,{"error":"not_found"})
    def do_HEAD(self):
        path=urllib.parse.urlparse(self.path).path
        if path.startswith("/d/"):return self.download(path)
        return self.do_GET()
    def do_POST(self):
        path=urllib.parse.urlparse(self.path).path
        if path=="/api/v1/transfers":return self.create_transfer()
        if path.startswith("/api/v1/transfers/") and path.endswith("/revoke"):
            if not self.authed():return self.out(401,{"error":"unauthorized"})
            tid=path.split("/")[4];row=row_transfer(tid)
            if not row:return self.out(404,{"error":"not_found"})
            shutil.rmtree(transfer_dir(tid),ignore_errors=True)
            with db() as con:con.execute("UPDATE transfers SET expires_at=?,purged_at=? WHERE id=?",(ts(),ts(),tid))
            return self.out(200,{"ok":True,"id":tid,"revoked":True})
        return self.out(404,{"error":"not_found"})
    def do_PUT(self):
        path=urllib.parse.urlparse(self.path).path;m=re.fullmatch(r"/api/v1/transfers/([^/]+)/files",path)
        if not m:return self.out(404,{"error":"not_found"})
        if not self.authed():return self.out(401,{"error":"unauthorized"})
        tid=urllib.parse.unquote(m.group(1));row=row_transfer(tid)
        if not row:return self.out(404,{"error":"not_found"})
        if row["purged_at"] or row["expires_at"]<=ts():return self.out(410,{"error":"expired"})
        try:n=int(self.headers.get("Content-Length","-1"))
        except ValueError:n=-1
        if n<0:return self.out(411,{"error":"content_length_required"})
        if n>MAX_FILE_BYTES:return self.out(413,{"error":"file_too_large","max_file_bytes":MAX_FILE_BYTES})
        if row["total_bytes"]+n>MAX_TRANSFER_BYTES:return self.out(413,{"error":"transfer_too_large","max_transfer_bytes":MAX_TRANSFER_BYTES})
        name=clean_name(urllib.parse.unquote(self.headers.get("X-Filename","file")));fid="f_"+secrets.token_hex(12);stored=fid+".bin";folder=transfer_dir(tid);folder.mkdir(parents=True,exist_ok=True)
        tmp=folder/(stored+".part");final=folder/stored;dig=hashlib.sha256();remaining=n
        try:
            with tmp.open("wb") as fh:
                while remaining:
                    chunk=self.rfile.read(min(1024*1024,remaining))
                    if not chunk:raise IOError("incomplete")
                    fh.write(chunk);dig.update(chunk);remaining-=len(chunk)
            tmp.replace(final)
        except Exception:
            tmp.unlink(missing_ok=True);return self.out(400,{"error":"incomplete_upload"})
        ctype=(self.headers.get("Content-Type") or mimetypes.guess_type(name)[0] or "application/octet-stream")[:120]
        with db() as con:
            con.execute("INSERT INTO files(id,transfer_id,display_name,stored_name,size_bytes,sha256,content_type,created_at) VALUES(?,?,?,?,?,?,?,?)",(fid,tid,name,stored,n,dig.hexdigest(),ctype,ts()))
            con.execute("UPDATE transfers SET total_bytes=total_bytes+?,file_count=file_count+1 WHERE id=?",(n,tid))
        return self.out(201,{"id":fid,"name":name,"size_bytes":n,"sha256":dig.hexdigest()})
    def create_transfer(self):
        if not self.authed():return self.out(401,{"error":"unauthorized"})
        try:b=self.json_body()
        except Exception:return self.out(400,{"error":"invalid_json"})
        entity=str(b.get("entity_id") or "").strip()[:100]
        if not entity:return self.out(400,{"error":"entity_id_required"})
        title=str(b.get("title") or "IZAKHONO Transfer").strip()[:160];note=str(b.get("note") or "").strip()[:2000]
        try:hours=max(1,min(int(b.get("expires_hours") or DEFAULT_EXPIRY_HOURS),MAX_EXPIRY_HOURS))
        except Exception:return self.out(400,{"error":"invalid_expiry"})
        md=b.get("max_downloads")
        if md in ("",None):md=None
        else:
            try:md=max(1,min(int(md),1000000))
            except Exception:return self.out(400,{"error":"invalid_max_downloads"})
        tid="tr_"+secrets.token_hex(10);secret=secrets.token_urlsafe(24);stamp=ts();expires=stamp+hours*3600
        with db() as con:con.execute("INSERT INTO transfers(id,entity_id,title,note,secret_hash,created_at,expires_at,max_downloads) VALUES(?,?,?,?,?,?,?,?)",(tid,entity,title,note,secret_hash(secret),stamp,expires,md))
        share=self.base()+"/t/"+urllib.parse.quote(tid)+"/"+urllib.parse.quote(secret)
        return self.out(201,{"id":tid,"entity_id":entity,"share_url":share,"expires_at":expires,"max_downloads":md})
    def public_meta(self,path):
        bits=path.split("/")
        if len(bits)<6:return self.out(404,{"error":"not_found"})
        tid=urllib.parse.unquote(bits[4]);secret=urllib.parse.unquote(bits[5]);row,err=share_check(tid,secret)
        if err:return self.out(410 if err!="not_found" else 404,{"error":err})
        with db() as con:files=con.execute("SELECT id,display_name,size_bytes,sha256,content_type FROM files WHERE transfer_id=? ORDER BY created_at,id",(tid,)).fetchall()
        return self.out(200,{"id":row["id"],"title":row["title"],"note":row["note"],"expires_at":row["expires_at"],"files":[{"id":f["id"],"name":f["display_name"],"size_bytes":f["size_bytes"],"sha256":f["sha256"],"content_type":f["content_type"]} for f in files]})
    def download(self,path):
        bits=path.split("/")
        if len(bits)!=5:return self.out(404,{"error":"not_found"})
        tid=urllib.parse.unquote(bits[2]);secret=urllib.parse.unquote(bits[3]);fid=urllib.parse.unquote(bits[4]);row,err=share_check(tid,secret)
        if err:return self.out(410 if err!="not_found" else 404,{"error":err})
        with db() as con:f=con.execute("SELECT * FROM files WHERE id=? AND transfer_id=?",(fid,tid)).fetchone()
        if not f:return self.out(404,{"error":"file_not_found"})
        pathf=transfer_dir(tid)/f["stored_name"]
        if not pathf.exists():return self.out(410,{"error":"file_unavailable"})
        size=f["size_bytes"];start=0;end=size-1;code=200;rh=self.headers.get("Range","")
        if rh:
            m=re.fullmatch(r"bytes=(\d*)-(\d*)",rh.strip())
            if not m:return self.out(416,{"error":"invalid_range"})
            if m.group(1):start=int(m.group(1));end=int(m.group(2)) if m.group(2) else size-1
            else:start=max(0,size-int(m.group(2) or "0"));end=size-1
            if start<0 or start>=size or end<start:return self.out(416,{"error":"range_not_satisfiable"})
            end=min(end,size-1);code=206
        should_count=(not rh or rh.startswith("bytes=0-")) and self.command!="HEAD"
        if should_count:
            with db() as con:
                fresh=con.execute("SELECT max_downloads,download_count FROM transfers WHERE id=?",(tid,)).fetchone()
                if fresh["max_downloads"] is not None and fresh["download_count"]>=fresh["max_downloads"]:return self.out(410,{"error":"download_limit_reached"})
                con.execute("UPDATE transfers SET download_count=download_count+1 WHERE id=?",(tid,))
        length=end-start+1;name=clean_name(f["display_name"]);ascii_name=re.sub(r"[^A-Za-z0-9._ -]","_",name) or "download"
        self.send_response(code);self.send_header("Content-Type",f["content_type"]);self.send_header("Content-Length",str(length));self.send_header("Accept-Ranges","bytes")
        self.send_header("Content-Disposition","attachment; filename=\""+ascii_name+"\"; filename*=UTF-8''"+urllib.parse.quote(name));self.send_header("ETag","\"sha256-"+f["sha256"]+"\"")
        if code==206:self.send_header("Content-Range","bytes "+str(start)+"-"+str(end)+"/"+str(size))
        self.headers_common();self.end_headers()
        if self.command=="HEAD":return
        with pathf.open("rb") as fh:
            fh.seek(start);remaining=length
            while remaining:
                chunk=fh.read(min(1024*1024,remaining))
                if not chunk:break
                self.wfile.write(chunk);remaining-=len(chunk)

def main():
    init_db();purge();threading.Thread(target=cleaner,daemon=True).start()
    server=ThreadingHTTPServer((HOST,PORT),H);owner_url="http://127.0.0.1:"+str(PORT)+"/#owner="+urllib.parse.quote(ADMIN_TOKEN)
    print("IZAKHONO SEND v"+VERSION);print("Listening on "+HOST+":"+str(PORT));print("Owner token file: "+str(TOKEN_FILE));print("Owner URL: "+owner_url)
    if os.name=="nt" and os.getenv("IZAKHONO_SEND_NO_BROWSER","").lower() not in ("1","true","yes"):threading.Timer(1.0,lambda:webbrowser.open(owner_url)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=="__main__":main()
