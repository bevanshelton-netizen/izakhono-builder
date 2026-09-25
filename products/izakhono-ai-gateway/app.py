#!/usr/bin/env python3
import hmac
import ipaddress
import json
import os
import socket
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_AI_GATEWAY_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_AI_GATEWAY_PORT", "9595"))
INTERNAL_KEY = os.getenv("IZAKHONO_AI_GATEWAY_INTERNAL_KEY", "")
ACCESS_URL = os.getenv("IZAKHONO_ACCESS_URL", "http://127.0.0.1:9494").rstrip("/")
ACCESS_KEY = os.getenv("IZAKHONO_ACCESS_INTERNAL_KEY", "")

OWNER_ONLY = os.getenv("IZAKHONO_AI_OWNER_ONLY", "true").lower() != "false"
ALLOW_EXTERNAL = os.getenv("IZAKHONO_AI_ALLOW_EXTERNAL", "false").lower() == "true"
MAX_BODY = int(os.getenv("IZAKHONO_AI_MAX_BODY", "1000000"))

DEFAULT_MODEL = os.getenv("IZAKHONO_AI_MODEL", "qwen3:4b")
OLLAMA_URL = os.getenv("IZAKHONO_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")

CAPABILITIES = {
    "chat": {
        "kind": "ollama_chat",
        "url": OLLAMA_URL,
        "model": os.getenv("IZAKHONO_AI_CHAT_MODEL", DEFAULT_MODEL),
        "models_env": "IZAKHONO_AI_CHAT_MODELS",
        "status": "ready",
    },
    "reasoning": {
        "kind": "ollama_chat",
        "url": OLLAMA_URL,
        "model": os.getenv("IZAKHONO_AI_REASONING_MODEL", DEFAULT_MODEL),
        "models_env": "IZAKHONO_AI_REASONING_MODELS",
        "status": "ready",
    },
    "code": {
        "kind": "ollama_chat",
        "url": OLLAMA_URL,
        "model": os.getenv("IZAKHONO_AI_CODE_MODEL", DEFAULT_MODEL),
        "models_env": "IZAKHONO_AI_CODE_MODELS",
        "status": "ready",
    },
    "image": {
        "kind": "json_generate",
        "url": os.getenv("IZAKHONO_IMAGE_URL", "").rstrip("/"),
        "model": os.getenv("IZAKHONO_IMAGE_MODEL", "flux.1-schnell"),
        "models_env": "IZAKHONO_IMAGE_MODELS",
        "status": "adapter",
    },
    "video": {
        "kind": "json_generate",
        "url": os.getenv("IZAKHONO_VIDEO_URL", "").rstrip("/"),
        "model": os.getenv("IZAKHONO_VIDEO_MODEL", "wan2.1"),
        "models_env": "IZAKHONO_VIDEO_MODELS",
        "status": "adapter",
    },
    "speech": {
        "kind": "json_generate",
        "url": os.getenv("IZAKHONO_SPEECH_URL", "").rstrip("/"),
        "model": os.getenv("IZAKHONO_SPEECH_MODEL", "kokoro"),
        "models_env": "IZAKHONO_SPEECH_MODELS",
        "status": "adapter",
    },
    "transcription": {
        "kind": "json_generate",
        "url": os.getenv("IZAKHONO_TRANSCRIPTION_URL", "").rstrip("/"),
        "model": os.getenv("IZAKHONO_TRANSCRIPTION_MODEL", "whisper"),
        "models_env": "IZAKHONO_TRANSCRIPTION_MODELS",
        "status": "adapter",
    },
}

def send_json(handler, status, obj):
    body = json.dumps(obj, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.send_header("referrer-policy", "no-referrer")
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
        raw = res.read()
        if not raw:
            return {}
        return json.loads(raw.decode())

def check_access(entity_id, subject, product):
    if not ACCESS_KEY:
        raise RuntimeError("access_service_key_missing")
    return http_json(
        ACCESS_URL + "/api/v1/check",
        {"entity_id": entity_id, "subject": subject, "product": product},
        {"x-izakhono-access-key": ACCESS_KEY},
        timeout=10,
    )

def is_private_ip(value):
    try:
        ip = ipaddress.ip_address(value)
        return ip.is_loopback or ip.is_private or ip.is_link_local
    except ValueError:
        return False

def host_allowed(url):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    explicit = {
        h.strip().lower()
        for h in os.getenv("IZAKHONO_AI_OWNER_HOSTS", "127.0.0.1,localhost").split(",")
        if h.strip()
    }
    if host in explicit or host == "localhost":
        return True
    if is_private_ip(host):
        return True
    try:
        for addr in socket.gethostbyname_ex(host)[2]:
            if is_private_ip(addr):
                return True
    except OSError:
        pass
    return bool(ALLOW_EXTERNAL and not OWNER_ONLY)

def allowed_models(capability):
    cfg = CAPABILITIES[capability]
    configured = os.getenv(cfg["models_env"], "")
    values = [m.strip() for m in configured.split(",") if m.strip()]
    if cfg["model"] not in values:
        values.append(cfg["model"])
    return values

def select_model(capability, requested):
    cfg = CAPABILITIES[capability]
    model = str(requested or cfg["model"]).strip()
    if model not in allowed_models(capability):
        raise ValueError("model_not_allowed")
    return model

def normalize_messages(payload):
    messages = payload.get("messages")
    if isinstance(messages, list) and messages:
        out = []
        for item in messages[:100]:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role") or "").strip()
            content = str(item.get("content") or "").strip()
            if role in ("system", "user", "assistant", "tool") and content:
                out.append({"role": role, "content": content[:100000]})
        if out:
            return out
    prompt = str(payload.get("input") or payload.get("prompt") or "").strip()
    return [{"role": "user", "content": prompt[:100000]}] if prompt else []

def model_chat(messages, model, capability="chat"):
    cfg = CAPABILITIES[capability]
    if not cfg["url"]:
        raise RuntimeError("capability_backend_unconfigured")
    if OWNER_ONLY and not host_allowed(cfg["url"]):
        raise RuntimeError("owner_route_required")
    return http_json(
        cfg["url"] + "/api/chat",
        {"model": model, "stream": False, "messages": messages},
        timeout=300,
    )

def json_generate(payload, model, capability):
    cfg = CAPABILITIES[capability]
    if not cfg["url"]:
        raise RuntimeError("capability_backend_unconfigured")
    if OWNER_ONLY and not host_allowed(cfg["url"]):
        raise RuntimeError("owner_route_required")
    request_payload = {
        "model": model,
        "input": payload.get("input"),
        "prompt": payload.get("prompt"),
        "options": payload.get("options") if isinstance(payload.get("options"), dict) else {},
    }
    return http_json(cfg["url"], request_payload, timeout=900)

def execute_capability(payload):
    capability = str(payload.get("capability") or "chat").strip().lower()
    if capability not in CAPABILITIES:
        raise ValueError("unsupported_capability")
    model = select_model(capability, payload.get("model"))
    cfg = CAPABILITIES[capability]
    if cfg["kind"] == "ollama_chat":
        messages = normalize_messages(payload)
        if not messages:
            raise ValueError("messages_or_input_required")
        raw = model_chat(messages, model, capability)
        output = str(raw.get("message", {}).get("content", "")).strip()
        if not output:
            raise RuntimeError("empty_model_response")
        return capability, model, {"type": "text", "text": output}, raw
    if cfg["kind"] == "json_generate":
        if payload.get("input") in (None, "") and payload.get("prompt") in (None, ""):
            raise ValueError("input_or_prompt_required")
        raw = json_generate(payload, model, capability)
        output = raw.get("output", raw.get("result", raw))
        return capability, model, {"type": capability, "data": output}, raw
    raise RuntimeError("capability_backend_invalid")

def capability_summary():
    items = []
    for name, cfg in CAPABILITIES.items():
        configured = bool(cfg["url"])
        owner_route = bool(cfg["url"] and host_allowed(cfg["url"]))
        items.append({
            "capability": name,
            "model": cfg["model"],
            "allowed_models": allowed_models(name),
            "configured": configured,
            "owner_route": owner_route,
            "status": "ready" if configured and owner_route else "needs_backend",
        })
    return items

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoSuperAI/0.2"

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
            caps = capability_summary()
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-super-ai",
                "version": "0.2",
                "usage_credit_gate": False,
                "subscriber_message_quota": None,
                "owner_only": OWNER_ONLY,
                "external_ai_providers_enabled": bool(ALLOW_EXTERNAL and not OWNER_ONLY),
                "capabilities_ready": [x["capability"] for x in caps if x["status"] == "ready"],
            })
        if p == "/api/v1/capabilities":
            if not self.authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-super-ai",
                "capabilities": capability_summary(),
                "privacy": {
                    "prompt_persistence": False,
                    "behavioural_tracking": False,
                    "advertising_ids": False,
                },
            })
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if p not in ("/api/v1/chat", "/api/v1/generate"):
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
        if not entity_id or not subject or not product:
            return send_json(self, 422, {"ok": False, "error": "entity_subject_product_required"})

        if p == "/api/v1/chat":
            payload["capability"] = "chat"

        try:
            access = check_access(entity_id, subject, product)
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": "access_service_unavailable", "detail": str(exc)[:200]})

        if not access.get("active"):
            return send_json(self, 403, {"ok": False, "error": "subscription_required"})

        try:
            capability, model, output, _raw = execute_capability(payload)
        except ValueError as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)[:100]})
        except urllib.error.HTTPError as exc:
            return send_json(self, 502, {"ok": False, "error": "model_backend_error", "status": exc.code})
        except Exception as exc:
            return send_json(self, 502, {"ok": False, "error": "model_backend_unavailable", "detail": str(exc)[:200]})

        response = {
            "ok": True,
            "capability": capability,
            "model": model,
            "output": output,
            "owner_only": OWNER_ONLY,
            "identity": {"entity_id": entity_id, "subject": subject},
            "subscription": {
                "active": True,
                "usage_credit_gate": False,
                "message_quota": None,
                "session_quota": None,
                "fair_use": True,
            },
        }
        if capability == "chat":
            response["answer"] = output["text"]
        return send_json(self, 200, response)

if __name__ == "__main__":
    print(f"IZAKHONO SUPER AI listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
