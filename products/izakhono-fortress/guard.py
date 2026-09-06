#!/usr/bin/env python3
import hmac, json, os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST=os.getenv("IZAKHONO_FORTRESS_HOST","127.0.0.1")
PORT=int(os.getenv("IZAKHONO_FORTRESS_PORT","9999"))
TOKEN=os.getenv("IZAKHONO_FORTRESS_TOKEN","")
POLICY_PATH=Path(os.getenv("IZAKHONO_FORTRESS_POLICY", Path(__file__).with_name("policy.json")))

FORBIDDEN_FIELDS={
    "password","passwd","secret","api_key","apikey","private_key","access_token",
    "refresh_token","authorization","cookie","card_number","cvv","cvc","pin"
}

def load_policy():
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))

def _contains_forbidden_field(value):
    if isinstance(value, dict):
        for k,v in value.items():
            if str(k).lower() in FORBIDDEN_FIELDS:
                return True
            if _contains_forbidden_field(v):
                return True
    elif isinstance(value, list):
        return any(_contains_forbidden_field(v) for v in value)
    return False

def authorize(req, policy=None):
    policy=policy or load_policy()
    entity_id=str(req.get("entity_id") or "").strip()
    provider_class=str(req.get("provider_class") or "").strip()
    purpose=str(req.get("purpose") or "").strip()
    data_class=str(req.get("data_class") or "").strip()
    payload=req.get("payload")

    if not entity_id:
        return False,"entity_scope_required"

    forbidden=set(policy["data_classes"]["forbidden_external"])
    allowed=set(policy["data_classes"]["allowed_external"])
    if data_class in forbidden:
        return False,"forbidden_data_class"
    if data_class not in allowed:
        return False,"data_class_not_allowlisted"

    if _contains_forbidden_field(payload):
        return False,"secret_like_field_detected"

    if provider_class=="external_ai":
        ai=policy["external_ai"]
        if purpose in ai["forbidden_purposes"]:
            return False,"forbidden_external_ai_purpose"
        if purpose not in ai["allowed_purposes"]:
            return False,"external_ai_purpose_not_allowlisted"
        return True,"allowed_external_ai_advisory"

    return False,"provider_class_not_allowlisted"

class H(BaseHTTPRequestHandler):
    def log_message(self,*args): pass

    def sendj(self,code,obj):
        body=json.dumps(obj,separators=(",",":")).encode()
        self.send_response(code)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authed(self):
        if not TOKEN:
            return False
        return hmac.compare_digest(self.headers.get("Authorization",""),f"Bearer {TOKEN}")

    def do_GET(self):
        if self.path=="/healthz":
            return self.sendj(200,{"ok":True,"service":"izakhono-fortress","default":"deny","host":HOST})
        if self.path=="/v1/policy":
            if not self.authed():
                return self.sendj(401,{"error":"unauthorized"})
            p=load_policy()
            return self.sendj(200,{
                "version":p["version"],
                "default":p["default"],
                "owner_controlled_runtime":p["principles"]["owner_controlled_runtime"],
                "external_ai_mode":p["external_ai"]["mode"]
            })
        return self.sendj(404,{"error":"not_found"})

    def do_POST(self):
        if self.path!="/v1/authorize-egress":
            return self.sendj(404,{"error":"not_found"})
        if not self.authed():
            return self.sendj(401,{"error":"unauthorized"})
        try:
            n=min(int(self.headers.get("Content-Length","0")),262144)
            req=json.loads(self.rfile.read(n))
        except Exception:
            return self.sendj(400,{"error":"invalid_json"})
        ok,reason=authorize(req)
        return self.sendj(200 if ok else 403,{"allowed":ok,"reason":reason})

if __name__=="__main__":
    if not TOKEN:
        raise SystemExit("IZAKHONO_FORTRESS_TOKEN is required")
    print(f"IZAKHONO FORTRESS listening on {HOST}:{PORT} with default-deny egress policy")
    ThreadingHTTPServer((HOST,PORT),H).serve_forever()
