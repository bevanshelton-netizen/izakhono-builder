#!/usr/bin/env python3
import hashlib
import http.client
import importlib.util
import json
import os
import tempfile
import threading
import urllib.parse
from pathlib import Path

tmp=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_SEND_ROOT"]=tmp.name
os.environ["IZAKHONO_SEND_ADMIN_TOKEN"]="test-owner-token"
os.environ["IZAKHONO_SEND_NO_BROWSER"]="1"

here=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("izakhono_send",here/"app.py")
app=importlib.util.module_from_spec(spec)
spec.loader.exec_module(app)
app.init_db()

server=app.ThreadingHTTPServer(("127.0.0.1",0),app.H)
port=server.server_address[1]
thread=threading.Thread(target=server.serve_forever,daemon=True)
thread.start()

def call(method,path,body=None,headers=None):
    con=http.client.HTTPConnection("127.0.0.1",port,timeout=10)
    con.request(method,path,body=body,headers=headers or {})
    res=con.getresponse()
    data=res.read()
    status=res.status
    headers_out=dict(res.getheaders())
    con.close()
    return status,data,headers_out

auth={"Authorization":"Bearer test-owner-token","Content-Type":"application/json"}

status,data,_=call("GET","/healthz")
assert status==200 and json.loads(data)["service"]=="izakhono-send"

payload=json.dumps({"entity_id":"entity-a","title":"Owner Node Installer","note":"Test transfer","expires_hours":24,"max_downloads":1}).encode()
status,data,_=call("POST","/api/v1/transfers",payload,auth)
assert status==201,(status,data)
t1=json.loads(data)
assert "/t/" in t1["share_url"]

blob=(b"IZAKHONO-SEND-TEST-"*4096)
headers={"Authorization":"Bearer test-owner-token","X-Filename":urllib.parse.quote("installer.zip"),"Content-Type":"application/zip"}
status,data,_=call("PUT","/api/v1/transfers/"+t1["id"]+"/files",blob,headers)
assert status==201,(status,data)
f1=json.loads(data)
assert f1["sha256"]==hashlib.sha256(blob).hexdigest()

parts=urllib.parse.urlparse(t1["share_url"]).path.split("/")
secret=parts[-1]
status,data,_=call("GET","/api/v1/public/"+t1["id"]+"/"+secret)
assert status==200,(status,data)
meta=json.loads(data)
assert meta["files"][0]["name"]=="installer.zip"

download="/d/"+t1["id"]+"/"+secret+"/"+f1["id"]
status,data,headers_out=call("GET",download)
assert status==200
assert data==blob
assert headers_out["Accept-Ranges"]=="bytes"

status,data,_=call("GET",download)
assert status==410 and json.loads(data)["error"]=="download_limit_reached"

payload=json.dumps({"entity_id":"entity-b","title":"Entity B","expires_hours":24}).encode()
status,data,_=call("POST","/api/v1/transfers",payload,auth)
assert status==201
t2=json.loads(data)

status,data,_=call("GET","/api/v1/transfers?entity_id=entity-a",headers={"Authorization":"Bearer test-owner-token"})
assert status==200
rows=json.loads(data)["transfers"]
assert len(rows)==1 and rows[0]["id"]==t1["id"] and rows[0]["entity_id"]=="entity-a"

status,data,_=call("GET","/api/v1/transfers?entity_id=entity-b",headers={"Authorization":"Bearer test-owner-token"})
assert status==200
rows=json.loads(data)["transfers"]
assert len(rows)==1 and rows[0]["id"]==t2["id"] and rows[0]["entity_id"]=="entity-b"

status,data,_=call("POST","/api/v1/transfers/"+t2["id"]+"/revoke",b"",{"Authorization":"Bearer test-owner-token"})
assert status==200
parts=urllib.parse.urlparse(t2["share_url"]).path.split("/")
status,data,_=call("GET","/api/v1/public/"+t2["id"]+"/"+parts[-1])
assert status==410

server.shutdown()
server.server_close()
thread.join(timeout=5)
print("IZAKHONO_SEND_TEST=PASS")
