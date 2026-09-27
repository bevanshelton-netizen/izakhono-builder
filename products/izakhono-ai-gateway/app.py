#!/usr/bin/env python3
import hmac
import ipaddress
import json
import os
import socket
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_AI_GATEWAY_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_AI_GATEWAY_PORT", "9595"))
INTERNAL_KEY = os.getenv("IZAKHONO_AI_GATEWAY_INTERNAL_KEY", "")
ACCESS_URL = os.getenv("IZAKHONO_ACCESS_URL", "http://127.0.0.1:9494").rstrip("/")
ACCESS_KEY = os.getenv("IZAKHONO_ACCESS_INTERNAL_KEY", "")
WORKFLOW_KEY = os.getenv("IZAKHONO_AI_WORKFLOW_KEY", "")
WORKFLOW_PRODUCTS = {x.strip().lower() for x in os.getenv("IZAKHONO_AI_WORKFLOW_PRODUCTS", "venture-factory,izakhono-builder,izakhono-docflow").split(",") if x.strip()}

OWNER_ONLY = os.getenv("IZAKHONO_AI_OWNER_ONLY", "true").lower() != "false"
ALLOW_EXTERNAL = os.getenv("IZAKHONO_AI_ALLOW_EXTERNAL", "false").lower() == "true"
MAX_BODY = int(os.getenv("IZAKHONO_AI_MAX_BODY", "1000000"))

DEFAULT_MODEL = os.getenv("IZAKHONO_AI_MODEL", "qwen3:4b")
OLLAMA_URL = os.getenv("IZAKHONO_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OWNER_TEXT_URLS_RAW = os.getenv("IZAKHONO_AI_OWNER_TEXT_URLS", "").strip()
OWNER_POOL_COOLDOWN_SECONDS = max(1, int(os.getenv("IZAKHONO_AI_OWNER_POOL_COOLDOWN_SECONDS", "30")))
OWNER_POOL_MAX = max(1, min(16, int(os.getenv("IZAKHONO_AI_OWNER_POOL_MAX", "8"))))
OWNER_POOL_LOCK = threading.Lock()
OWNER_POOL_STATE = {}

# Optional external text route. It is deliberately disabled unless BOTH
# IZAKHONO_AI_ALLOW_EXTERNAL=true and IZAKHONO_AI_OWNER_ONLY=false are set.
# External routing is explicit per request and only accepts data classified
# as public. Secrets stay server-side.
EXTERNAL_TEXT_PROVIDER = os.getenv("IZAKHONO_AI_EXTERNAL_TEXT_PROVIDER", "external-openai").strip().lower()
EXTERNAL_TEXT_URL = os.getenv("IZAKHONO_AI_EXTERNAL_TEXT_URL", "").rstrip("/")
EXTERNAL_TEXT_API_KEY = os.getenv("IZAKHONO_AI_EXTERNAL_TEXT_API_KEY", "")
EXTERNAL_TEXT_MODEL = os.getenv("IZAKHONO_AI_EXTERNAL_TEXT_MODEL", "").strip()
EXTERNAL_TEXT_HOSTS = {
    h.strip().lower()
    for h in os.getenv("IZAKHONO_AI_EXTERNAL_HOSTS", "integrate.api.nvidia.com").split(",")
    if h.strip()
}

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

def workflow_key_allowed(supplied, product):
    return bool(
        WORKFLOW_KEY
        and supplied
        and safe_equal(supplied, WORKFLOW_KEY)
        and str(product or "").strip().lower() in WORKFLOW_PRODUCTS
    )

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

def owner_runtime_allowed(url):
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
        addresses = socket.gethostbyname_ex(host)[2]
        return bool(addresses) and all(is_private_ip(addr) for addr in addresses)
    except OSError:
        return False

def host_allowed(url):
    # Backward-compatible alias. Owner routes never become public merely because
    # an unrelated external development adapter has been enabled.
    return owner_runtime_allowed(url)

def owner_text_urls():
    raw = OWNER_TEXT_URLS_RAW
    values = [x.strip().rstrip("/") for x in raw.split(",") if x.strip()] if raw else [OLLAMA_URL]
    unique = []
    for value in values:
        if value and value not in unique:
            unique.append(value)
        if len(unique) >= OWNER_POOL_MAX:
            break
    return unique

def owner_runtime_id(url):
    urls = owner_text_urls()
    try:
        return f"owner-text-{urls.index(url) + 1}"
    except ValueError:
        return "owner-text-unknown"

def owner_pool_mark(url, ok, detail=""):
    now = time.time()
    with OWNER_POOL_LOCK:
        current = dict(OWNER_POOL_STATE.get(url, {}))
        if ok:
            current.update({
                "failures": 0,
                "blocked_until": 0.0,
                "last_ok": now,
                "last_error": "",
            })
        else:
            failures = int(current.get("failures", 0)) + 1
            current.update({
                "failures": failures,
                "blocked_until": now + OWNER_POOL_COOLDOWN_SECONDS,
                "last_error": str(detail or "backend_unavailable")[:160],
            })
        OWNER_POOL_STATE[url] = current

def owner_pool_candidates():
    urls = owner_text_urls()
    now = time.time()
    ready = []
    cooling = []
    with OWNER_POOL_LOCK:
        snapshot = {k: dict(v) for k, v in OWNER_POOL_STATE.items()}
    for url in urls:
        if not owner_runtime_allowed(url):
            continue
        state = snapshot.get(url, {})
        if float(state.get("blocked_until", 0) or 0) > now:
            cooling.append(url)
        else:
            ready.append(url)
    # If all known owner runtimes are cooling down, retry them in configured
    # order rather than fail permanently.
    return ready or cooling

def owner_pool_summary():
    now = time.time()
    urls = owner_text_urls()
    with OWNER_POOL_LOCK:
        snapshot = {k: dict(v) for k, v in OWNER_POOL_STATE.items()}
    items = []
    for url in urls:
        state = snapshot.get(url, {})
        allowed = owner_runtime_allowed(url)
        blocked_until = float(state.get("blocked_until", 0) or 0)
        items.append({
            "runtime_id": owner_runtime_id(url),
            "allowed": allowed,
            "available_for_attempt": bool(allowed and blocked_until <= now),
            "cooldown_seconds_remaining": max(0, int(blocked_until - now)) if allowed else 0,
            "failures": int(state.get("failures", 0) or 0),
            "last_ok": state.get("last_ok"),
            "last_error": state.get("last_error") or None,
        })
    return items

def external_host_allowed(url):
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    host = parsed.hostname.lower()
    if host not in EXTERNAL_TEXT_HOSTS:
        return False
    if parsed.scheme == "http":
        if host == "localhost" or is_private_ip(host):
            return True
        try:
            return all(is_private_ip(addr) for addr in socket.gethostbyname_ex(host)[2])
        except OSError:
            return False
    return True

def external_text_configured():
    return bool(
        ALLOW_EXTERNAL
        and not OWNER_ONLY
        and EXTERNAL_TEXT_URL
        and EXTERNAL_TEXT_API_KEY
        and EXTERNAL_TEXT_MODEL
        and external_host_allowed(EXTERNAL_TEXT_URL)
    )

def allowed_models(capability):
    cfg = CAPABILITIES[capability]
    configured = os.getenv(cfg["models_env"], "")
    values = [m.strip() for m in configured.split(",") if m.strip()]
    if cfg["model"] not in values:
        values.append(cfg["model"])
    return values

def external_allowed_models():
    configured = os.getenv("IZAKHONO_AI_EXTERNAL_TEXT_MODELS", "")
    values = [m.strip() for m in configured.split(",") if m.strip()]
    if EXTERNAL_TEXT_MODEL and EXTERNAL_TEXT_MODEL not in values:
        values.append(EXTERNAL_TEXT_MODEL)
    return values

def select_model(capability, requested, route="owned"):
    if route == "external":
        model = str(requested or EXTERNAL_TEXT_MODEL).strip()
        if not model:
            raise RuntimeError("external_model_unconfigured")
        if model not in external_allowed_models():
            raise ValueError("model_not_allowed")
        return model
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
    candidates = owner_pool_candidates()
    if not candidates:
        raise RuntimeError("owner_model_pool_unconfigured")
    errors = []
    for runtime_url in candidates:
        try:
            raw = http_json(
                runtime_url + "/api/chat",
                {"model": model, "stream": False, "messages": messages},
                timeout=300,
            )
            if isinstance(raw, dict):
                raw["_izakhono_owner_runtime"] = owner_runtime_id(runtime_url)
            owner_pool_mark(runtime_url, True)
            return raw
        except Exception as exc:
            owner_pool_mark(runtime_url, False, exc)
            errors.append(f"{owner_runtime_id(runtime_url)}:{type(exc).__name__}")
    raise RuntimeError("owner_model_pool_unavailable:" + ",".join(errors[:OWNER_POOL_MAX]))

def openai_chat(messages, model):
    if not external_text_configured():
        raise RuntimeError("external_route_disabled")
    return http_json(
        EXTERNAL_TEXT_URL + "/chat/completions",
        {"model": model, "stream": False, "messages": messages},
        {"authorization": "Bearer " + EXTERNAL_TEXT_API_KEY},
        timeout=300,
    )

def select_route(payload, capability):
    route = str(payload.get("route") or "owned").strip().lower()
    if route not in ("owned", "external"):
        raise ValueError("route_not_allowed")
    if route == "external":
        if capability not in ("chat", "reasoning", "code"):
            raise ValueError("external_route_capability_not_allowed")
        classification = str(payload.get("data_classification") or "").strip().lower()
        if classification != "public":
            raise ValueError("external_route_requires_public_data")
        if not external_text_configured():
            raise RuntimeError("external_route_disabled")
    return route

def json_generate(payload, model, capability):
    cfg = CAPABILITIES[capability]
    if not cfg["url"]:
        raise RuntimeError("capability_backend_unconfigured")
    if not owner_runtime_allowed(cfg["url"]):
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
    route = select_route(payload, capability)
    model = select_model(capability, payload.get("model"), route)
    cfg = CAPABILITIES[capability]
    if cfg["kind"] == "ollama_chat":
        messages = normalize_messages(payload)
        if not messages:
            raise ValueError("messages_or_input_required")
        if route == "external":
            raw = openai_chat(messages, model)
            choices = raw.get("choices") if isinstance(raw, dict) else None
            message = choices[0].get("message", {}) if isinstance(choices, list) and choices and isinstance(choices[0], dict) else {}
            output = str(message.get("content", "")).strip()
        else:
            raw = model_chat(messages, model, capability)
            output = str(raw.get("message", {}).get("content", "")).strip()
        if not output:
            raise RuntimeError("empty_model_response")
        return capability, model, {"type": "text", "text": output}, raw, route
    if cfg["kind"] == "json_generate":
        if payload.get("input") in (None, "") and payload.get("prompt") in (None, ""):
            raise ValueError("input_or_prompt_required")
        raw = json_generate(payload, model, capability)
        output = raw.get("output", raw.get("result", raw))
        return capability, model, {"type": capability, "data": output}, raw, route
    raise RuntimeError("capability_backend_invalid")

def capability_summary():
    items = []
    for name, cfg in CAPABILITIES.items():
        configured = bool(cfg["url"])
        if cfg["kind"] == "ollama_chat":
            pool = owner_pool_summary()
            owner_route = any(x["allowed"] for x in pool)
            configured = bool(pool)
        else:
            owner_route = bool(cfg["url"] and owner_runtime_allowed(cfg["url"]))
        items.append({
            "capability": name,
            "model": cfg["model"],
            "allowed_models": allowed_models(name),
            "configured": configured,
            "owner_route": owner_route,
            "external_route_available": bool(name in ("chat", "reasoning", "code") and external_text_configured()),
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

    def workflow_authorized(self, product):
        supplied = self.headers.get("x-izakhono-ai-workflow-key", "")
        return workflow_key_allowed(supplied, product)

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
                "external_ai_providers_enabled": external_text_configured(),
                "external_ai_provider": EXTERNAL_TEXT_PROVIDER if external_text_configured() else None,
                "workflow_mode_configured": bool(WORKFLOW_KEY),
                "subscriber_access_configured": bool(ACCESS_KEY),
                "workflow_products": sorted(WORKFLOW_PRODUCTS),
                "owner_text_pool_size": len(owner_text_urls()),
                "owner_text_pool_available": sum(1 for x in owner_pool_summary() if x["available_for_attempt"]),
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
        if p == "/api/v1/runtimes":
            if not self.authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-super-ai",
                "owner_text_pool": owner_pool_summary(),
                "external_text": {
                    "enabled": external_text_configured(),
                    "provider": EXTERNAL_TEXT_PROVIDER if external_text_configured() else None,
                    "public_data_only": True,
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
        access_mode = str(payload.get("access_mode") or "subscriber").strip().lower()
        if not entity_id or not product:
            return send_json(self, 422, {"ok": False, "error": "entity_product_required"})

        if p == "/api/v1/chat":
            payload["capability"] = "chat"

        workflow_mode = access_mode == "workflow"
        if workflow_mode:
            if not self.workflow_authorized(product):
                return send_json(self, 403, {"ok": False, "error": "workflow_not_authorized"})
            if not subject:
                subject = "izakhono-workflow"
            access = {"active": True, "mode": "workflow"}
        else:
            if not subject:
                return send_json(self, 422, {"ok": False, "error": "subject_required"})
            try:
                access = check_access(entity_id, subject, product)
            except Exception as exc:
                return send_json(self, 503, {"ok": False, "error": "access_service_unavailable", "detail": str(exc)[:200]})

            if not access.get("active"):
                return send_json(self, 403, {"ok": False, "error": "subscription_required"})

        try:
            capability, model, output, _raw, route = execute_capability(payload)
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
            "route": route,
            "external_provider": EXTERNAL_TEXT_PROVIDER if route == "external" else None,
            "owner_runtime": _raw.get("_izakhono_owner_runtime") if route == "owned" and isinstance(_raw, dict) else None,
            "data_classification": str(payload.get("data_classification") or ("public" if route == "external" else "internal")).strip().lower(),
            "output": output,
            "owner_only": OWNER_ONLY,
            "identity": {"entity_id": entity_id, "subject": subject},
            "authorization": {
                "mode": "workflow" if workflow_mode else "subscriber",
                "product": product,
            },
            "subscription": None if workflow_mode else {
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
