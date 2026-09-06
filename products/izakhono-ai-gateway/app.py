#!/usr/bin/env python3
import hmac
import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_AI_GATEWAY_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_AI_GATEWAY_PORT", "9595"))
INTERNAL_KEY = os.getenv("IZAKHONO_AI_GATEWAY_INTERNAL_KEY", "")
ACCESS_URL = os.getenv("IZAKHONO_ACCESS_URL", "http://127.0.0.1:9494").rstrip("/")
ACCESS_KEY = os.getenv("IZAKHONO_ACCESS_INTERNAL_KEY", "")
OLLAMA_URL = os.getenv("IZAKHONO_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = os.getenv("IZAKHONO_AI_MODEL", "qwen3:4b")
OWNER_ONLY = os.getenv("IZAKHONO_AI_OWNER_ONLY", "true").lower() != "false"
MAX_BODY = 1_000_000

def send_json(handler, status, obj):
    body = json.dumps(obj, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)

def safe_equal(a, b):
    return hmac.compare_digest(str(a), str(b))

def http_json(url, payload=None, headers=None, timeout=120):
    body = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"content-type": "application/json", **(headers or {})},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode())

def check_access(entity_id, subject, product):
    if not ACCESS_KEY:
        raise RuntimeError("access_service_key_missing")
    return http_json(
        ACCESS_URL + "/api/v1/check",
        {"entity_id": entity_id, "subject": subject, "product": product},
        {"x-izakhono-access-key": ACCESS_KEY},
        timeout=10,
    )

def model_chat(messages, model):
    if not OWNER_ONLY:
        raise RuntimeError("external_ai_providers_disabled")
    return http_json(
        OLLAMA_URL + "/api/chat",
        {"model": model, "stream": False, "messages": messages},
        timeout=300,
    )

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoAIGateway/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def authorized(self):
        supplied = self.headers.get("x-izakhono-ai-key", "")
        return bool(INTERNAL_KEY and supplied and safe_equal(supplied, INTERNAL_KEY))

    def read_json(self):
        n = int(self.headers.get("content-length", "0") or "0")
        if n <= 0 or n > MAX_BODY:
            raise ValueError("invalid_body_size")
        return json.loads(self.rfile.read(n).decode())

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/healthz":
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-ai-gateway",
                "usage_credit_gate": False,
                "subscriber_message_quota": None,
                "default_model": DEFAULT_MODEL,
                "owner_only": OWNER_ONLY,
                "external_ai_providers": False,
            })
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if p != "/api/v1/chat":
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        if not self.authorized():
            return send_json(self, 401, {"ok": False, "error": "unauthorized"})

        try:
            payload = self.read_json()
        except Exception:
            return send_json(self, 400, {"ok": False, "error": "invalid_json"})

        entity_id = str(payload.get("entity_id") or "").strip().lower()
        subject = str(payload.get("subject") or "").strip().lower()
        product = str(payload.get("product") or "").strip().lower()
        model = str(payload.get("model") or DEFAULT_MODEL).strip()
        messages = payload.get("messages")
        if not entity_id or not subject or not product or not isinstance(messages, list) or not messages:
            return send_json(self, 422, {"ok": False, "error": "entity_subject_product_messages_required"})

        try:
            access = check_access(entity_id, subject, product)
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": "access_service_unavailable", "detail": str(exc)[:200]})

        if not access.get("active"):
            return send_json(self, 403, {"ok": False, "error": "subscription_required"})

        try:
            result = model_chat(messages, model)
            answer = str(result.get("message", {}).get("content", "")).strip()
            if not answer:
                raise RuntimeError("empty_model_response")
        except urllib.error.HTTPError as exc:
            return send_json(self, 502, {"ok": False, "error": "model_backend_error", "status": exc.code})
        except Exception as exc:
            return send_json(self, 502, {"ok": False, "error": "model_backend_unavailable", "detail": str(exc)[:200]})

        return send_json(self, 200, {
            "ok": True,
            "answer": answer,
            "model": model,
            "owner_only": OWNER_ONLY,
            "identity": {"entity_id": entity_id, "subject": subject},
            "subscription": {
                "active": True,
                "usage_credit_gate": False,
                "message_quota": None,
                "session_quota": None,
                "fair_use": True,
            },
        })

if __name__ == "__main__":
    print(f"IZAKHONO AI GATEWAY listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
