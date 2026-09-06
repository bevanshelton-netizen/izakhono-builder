#!/usr/bin/env python3
import importlib.util
import json
import os
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

TMP=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_INTELLIGENCE_DATA"]=TMP.name
os.environ["IZAKHONO_ID_INTERNAL_KEY"]="id-test"
os.environ["IZAKHONO_AI_GATEWAY_INTERNAL_KEY"]="ai-test"
os.environ["IZAKHONO_ID_URL"]="http://127.0.0.1:19696"
os.environ["IZAKHONO_AI_GATEWAY_URL"]="http://127.0.0.1:19595"

class IdMock(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        n=int(self.headers.get("content-length","0")); json.loads(self.rfile.read(n))
        body=json.dumps({"ok":True,"active":True,"subject":"user@example.com","entity_id":"entity-a","entity_slug":"entity-a","role":"member"}).encode()
        self.send_response(200);self.send_header("content-type","application/json");self.send_header("content-length",str(len(body)));self.end_headers();self.wfile.write(body)

class AiMock(BaseHTTPRequestHandler):
    def log_message(self,*args): pass
    def do_POST(self):
        n=int(self.headers.get("content-length","0")); data=json.loads(self.rfile.read(n))
        assert data["entity_id"]=="entity-a"
        body=json.dumps({"ok":True,"answer":"mock intelligence","subscription":{"active":True,"usage_credit_gate":False,"message_quota":None}}).encode()
        self.send_response(200);self.send_header("content-type","application/json");self.send_header("content-length",str(len(body)));self.end_headers();self.wfile.write(body)

id_server=ThreadingHTTPServer(("127.0.0.1",19696),IdMock)
ai_server=ThreadingHTTPServer(("127.0.0.1",19595),AiMock)
threading.Thread(target=id_server.serve_forever,daemon=True).start()
threading.Thread(target=ai_server.serve_forever,daemon=True).start()

spec=importlib.util.spec_from_file_location("intel",Path(__file__).with_name("app.py"))
app=importlib.util.module_from_spec(spec);spec.loader.exec_module(app)

ident=app.introspect("token")
assert ident["entity_id"]=="entity-a"
out=app.ai_chat("entity-a","user@example.com","faisready",[{"role":"user","content":"hello"}])
assert out["answer"]=="mock intelligence"
assert app.safe_calculate("2+3*4")==14

with app.db_connect() as db:
    db.execute("INSERT INTO conversations(id,entity_id,subject,product_slug,title,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
               ("c1","entity-a","user@example.com","faisready","A",app.now_iso(),app.now_iso()))
    db.execute("INSERT INTO conversations(id,entity_id,subject,product_slug,title,created_at,updated_at) VALUES(?,?,?,?,?,?,?)",
               ("c2","entity-b","user@example.com","faisready","B",app.now_iso(),app.now_iso()))
    db.commit()
    a=db.execute("SELECT count(*) n FROM conversations WHERE entity_id='entity-a'").fetchone()["n"]
    b=db.execute("SELECT count(*) n FROM conversations WHERE entity_id='entity-b'").fetchone()["n"]
    assert a==1 and b==1

print("IZAKHONO_INTELLIGENCE_10_TEST=PASS")
id_server.shutdown();ai_server.shutdown();TMP.cleanup()
