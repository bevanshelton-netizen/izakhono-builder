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
WORKFLOW_PRODUCTS = {x.strip().lower() for x in os.getenv("IZAKHONO_AI_WORKFLOW_PRODUCTS", "venture-factory,izakhono-builder,izakhono-docflow,izakhono-flow").split(",") if x.strip()}

OWNER_ONLY = os.getenv("IZAKHONO_AI_OWNER_ONLY", "true").lower() != "false"
ALLOW_EXTERNAL = os.getenv("IZAKHONO_AI_ALLOW_EXTERNAL", "false").lower() == "true"
MAX_BODY = int(os.getenv("IZAKHONO_AI_MAX_BODY", "16000000"))

DEFAULT_MODEL = os.getenv("IZAKHONO_AI_MODEL", "qwen3:4b")
OLLAMA_URL = os.getenv("IZAKHONO_OLLAMA_URL", "http://127.0.0.1:11434").rstrip("/")
OWNER_TEXT_URLS_RAW = os.getenv("IZAKHONO_AI_OWNER_TEXT_URLS", "").strip()
OWNER_POOL_COOLDOWN_SECONDS = max(1, int(os.getenv("IZAKHONO_AI_OWNER_POOL_COOLDOWN_SECONDS", "30")))
OWNER_POOL_MAX = max(1, min(16, int(os.getenv("IZAKHONO_AI_OWNER_POOL_MAX", "8"))))
OWNER_POOL_LOCK = threading.Lock()
OWNER_POOL_STATE = {}

GATEWAY_MAX_INFLIGHT = max(1, int(os.getenv("IZAKHONO_AI_MAX_INFLIGHT", "4")))
GATEWAY_MAX_QUEUE = max(0, int(os.getenv("IZAKHONO_AI_MAX_QUEUE", "16")))
GATEWAY_QUEUE_TIMEOUT_SECONDS = max(0.05, float(os.getenv("IZAKHONO_AI_QUEUE_TIMEOUT_SECONDS", "20")))

OWNER_ROUTING_EWMA_ALPHA = min(1.0, max(0.05, float(os.getenv("IZAKHONO_AI_ROUTING_EWMA_ALPHA", "0.35"))))
OWNER_ROUTING_UNKNOWN_LATENCY_MS = max(1.0, float(os.getenv("IZAKHONO_AI_ROUTING_UNKNOWN_LATENCY_MS", "3000")))
OWNER_ROUTING_INFLIGHT_PENALTY_MS = max(0.0, float(os.getenv("IZAKHONO_AI_ROUTING_INFLIGHT_PENALTY_MS", "1500")))
OWNER_ROUTING_WARM_BONUS_MS = max(0.0, float(os.getenv("IZAKHONO_AI_ROUTING_WARM_BONUS_MS", "600")))
OWNER_WARM_MODELS_RAW = os.getenv("IZAKHONO_AI_WARM_MODELS", "").strip()
OWNER_WARM_MAX_MODELS = max(1, min(8, int(os.getenv("IZAKHONO_AI_WARM_MAX_MODELS", "3"))))
OWNER_WARM_KEEP_ALIVE = os.getenv("IZAKHONO_AI_WARM_KEEP_ALIVE", "15m").strip() or "15m"
OWNER_WARM_TTL_SECONDS = max(1, int(os.getenv("IZAKHONO_AI_WARM_TTL_SECONDS", "900")))
OWNER_WARM_TIMEOUT_SECONDS = max(1, int(os.getenv("IZAKHONO_AI_WARM_TIMEOUT_SECONDS", "180")))

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
        "kind": "video_generate",
        "url": os.getenv("IZAKHONO_VIDEO_URL", "").rstrip("/"),
        "key": os.getenv("IZAKHONO_VIDEO_INTERNAL_KEY", ""),
        "model": os.getenv("IZAKHONO_VIDEO_MODEL", "wan2.1"),
        "models_env": "IZAKHONO_VIDEO_MODELS",
        "status": "adapter",
    },
    "speech": {
        "kind": "speech_generate",
        "url": os.getenv("IZAKHONO_SPEECH_URL", "").rstrip("/"),
        "key": os.getenv("IZAKHONO_SPEECH_INTERNAL_KEY", ""),
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

class CapacityUnavailable(RuntimeError):
    pass

class AdmissionController:
    def __init__(self, max_inflight, max_queue, timeout_seconds):
        self.max_inflight = max(1, int(max_inflight))
        self.max_queue = max(0, int(max_queue))
        self.timeout_seconds = max(0.01, float(timeout_seconds))
        self.condition = threading.Condition()
        self.inflight = 0
        self.queued = 0
        self.rejected = 0
        self.completed = 0

    def acquire(self):
        with self.condition:
            if self.inflight < self.max_inflight:
                self.inflight += 1
                return
            if self.queued >= self.max_queue:
                self.rejected += 1
                raise CapacityUnavailable("queue_full")
            self.queued += 1
            deadline = time.monotonic() + self.timeout_seconds
            try:
                while self.inflight >= self.max_inflight:
                    remaining = deadline - time.monotonic()
                    if remaining <= 0:
                        self.rejected += 1
                        raise CapacityUnavailable("queue_timeout")
                    self.condition.wait(timeout=remaining)
                self.inflight += 1
            finally:
                self.queued = max(0, self.queued - 1)

    def release(self):
        with self.condition:
            self.inflight = max(0, self.inflight - 1)
            self.completed += 1
            self.condition.notify()

    def summary(self):
        with self.condition:
            return {
                "max_inflight": self.max_inflight,
                "max_queue": self.max_queue,
                "queue_timeout_seconds": self.timeout_seconds,
                "inflight": self.inflight,
                "queued": self.queued,
                "rejected": self.rejected,
                "completed": self.completed,
            }

ADMISSION = AdmissionController(GATEWAY_MAX_INFLIGHT, GATEWAY_MAX_QUEUE, GATEWAY_QUEUE_TIMEOUT_SECONDS)

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

def owner_pool_mark(url, ok, detail="", elapsed_ms=None, model=None):
    now = time.time()
    with OWNER_POOL_LOCK:
        current = dict(OWNER_POOL_STATE.get(url, {}))
        model_stats = dict(current.get("model_stats") or {})
        warm_models = dict(current.get("warm_models") or {})
        if ok:
            current.update({
                "failures": 0,
                "blocked_until": 0.0,
                "last_ok": now,
                "last_error": "",
            })
            if elapsed_ms is not None:
                elapsed = max(0.0, float(elapsed_ms))
                previous = current.get("latency_ewma_ms")
                current["latency_ewma_ms"] = elapsed if previous is None else (
                    OWNER_ROUTING_EWMA_ALPHA * elapsed +
                    (1.0 - OWNER_ROUTING_EWMA_ALPHA) * float(previous)
                )
                current["samples"] = int(current.get("samples", 0) or 0) + 1
            if model:
                item = dict(model_stats.get(model) or {})
                if elapsed_ms is not None:
                    elapsed = max(0.0, float(elapsed_ms))
                    previous = item.get("latency_ewma_ms")
                    item["latency_ewma_ms"] = elapsed if previous is None else (
                        OWNER_ROUTING_EWMA_ALPHA * elapsed +
                        (1.0 - OWNER_ROUTING_EWMA_ALPHA) * float(previous)
                    )
                    item["samples"] = int(item.get("samples", 0) or 0) + 1
                item["last_ok"] = now
                item["last_error"] = ""
                model_stats[model] = item
                warm_models[model] = now
        else:
            failures = int(current.get("failures", 0)) + 1
            current.update({
                "failures": failures,
                "blocked_until": now + OWNER_POOL_COOLDOWN_SECONDS,
                "last_error": str(detail or "backend_unavailable")[:160],
            })
            if model:
                item = dict(model_stats.get(model) or {})
                item["failures"] = int(item.get("failures", 0) or 0) + 1
                item["last_error"] = str(detail or "backend_unavailable")[:160]
                model_stats[model] = item
        current["model_stats"] = model_stats
        current["warm_models"] = warm_models
        OWNER_POOL_STATE[url] = current

def owner_warm_mark(url, model, ok, detail=""):
    now = time.time()
    with OWNER_POOL_LOCK:
        current = dict(OWNER_POOL_STATE.get(url, {}))
        warm_models = dict(current.get("warm_models") or {})
        warm_errors = dict(current.get("warm_errors") or {})
        if ok:
            warm_models[model] = now
            warm_errors.pop(model, None)
        else:
            warm_errors[model] = str(detail or "warm_failed")[:160]
        current["warm_models"] = warm_models
        current["warm_errors"] = warm_errors
        OWNER_POOL_STATE[url] = current

def owner_model_is_warm(state, model, now=None):
    if not model:
        return False
    now = time.time() if now is None else now
    warm_models = state.get("warm_models") or {}
    last_warm = float(warm_models.get(model, 0) or 0)
    return bool(last_warm and (now - last_warm) <= OWNER_WARM_TTL_SECONDS)

def owner_candidate_score(state, model, index, now=None):
    now = time.time() if now is None else now
    model_stats = state.get("model_stats") or {}
    model_item = model_stats.get(model) if model else None
    predicted = None
    if isinstance(model_item, dict):
        predicted = model_item.get("latency_ewma_ms")
    if predicted is None:
        predicted = state.get("latency_ewma_ms")
    if predicted is None:
        predicted = OWNER_ROUTING_UNKNOWN_LATENCY_MS
    inflight = int(state.get("inflight", 0) or 0)
    warm_bonus = OWNER_ROUTING_WARM_BONUS_MS if owner_model_is_warm(state, model, now) else 0.0
    score = max(0.0, float(predicted) + inflight * OWNER_ROUTING_INFLIGHT_PENALTY_MS - warm_bonus)
    return score, index

def owner_pool_candidates(model=None):
    urls = owner_text_urls()
    now = time.time()
    ready = []
    cooling = []
    with OWNER_POOL_LOCK:
        snapshot = {k: dict(v) for k, v in OWNER_POOL_STATE.items()}
    for index, url in enumerate(urls):
        if not owner_runtime_allowed(url):
            continue
        state = snapshot.get(url, {})
        score, tie_break = owner_candidate_score(state, model, index, now)
        item = (score, tie_break, url)
        if float(state.get("blocked_until", 0) or 0) > now:
            cooling.append(item)
        else:
            ready.append(item)
    candidates = ready or cooling
    candidates.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in candidates]

def owner_pool_begin(url):
    with OWNER_POOL_LOCK:
        current = dict(OWNER_POOL_STATE.get(url, {}))
        current["inflight"] = int(current.get("inflight", 0) or 0) + 1
        OWNER_POOL_STATE[url] = current

def owner_pool_end(url):
    with OWNER_POOL_LOCK:
        current = dict(OWNER_POOL_STATE.get(url, {}))
        current["inflight"] = max(0, int(current.get("inflight", 0) or 0) - 1)
        OWNER_POOL_STATE[url] = current

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
        model_stats = state.get("model_stats") or {}
        warm_models = state.get("warm_models") or {}
        items.append({
            "runtime_id": owner_runtime_id(url),
            "allowed": allowed,
            "available_for_attempt": bool(allowed and blocked_until <= now),
            "cooldown_seconds_remaining": max(0, int(blocked_until - now)) if allowed else 0,
            "failures": int(state.get("failures", 0) or 0),
            "inflight": int(state.get("inflight", 0) or 0),
            "latency_ewma_ms": round(float(state["latency_ewma_ms"]), 2) if state.get("latency_ewma_ms") is not None else None,
            "samples": int(state.get("samples", 0) or 0),
            "warm_models": sorted(
                model for model, stamp in warm_models.items()
                if float(stamp or 0) and (now - float(stamp)) <= OWNER_WARM_TTL_SECONDS
            ),
            "model_benchmarks": [
                {
                    "model": model,
                    "latency_ewma_ms": round(float(item["latency_ewma_ms"]), 2) if item.get("latency_ewma_ms") is not None else None,
                    "samples": int(item.get("samples", 0) or 0),
                    "last_ok": item.get("last_ok"),
                }
                for model, item in sorted(model_stats.items())
            ],
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

def configured_warm_models():
    allowed = []
    for capability in ("chat", "reasoning", "code"):
        for model in allowed_models(capability):
            if model not in allowed:
                allowed.append(model)
    requested = [m.strip() for m in OWNER_WARM_MODELS_RAW.split(",") if m.strip()]
    values = requested or [
        CAPABILITIES["chat"]["model"],
        CAPABILITIES["reasoning"]["model"],
        CAPABILITIES["code"]["model"],
    ]
    result = []
    for model in values:
        if model in allowed and model not in result:
            result.append(model)
        if len(result) >= OWNER_WARM_MAX_MODELS:
            break
    return result

def warm_pool_summary():
    now = time.time()
    configured = configured_warm_models()
    active_pairs = 0
    with OWNER_POOL_LOCK:
        snapshot = {k: dict(v) for k, v in OWNER_POOL_STATE.items()}
    for url in owner_text_urls():
        state = snapshot.get(url, {})
        for model in configured:
            if owner_model_is_warm(state, model, now):
                active_pairs += 1
    return {
        "configured_model_count": len(configured),
        "active_runtime_model_pairs": active_pairs,
        "keep_alive": OWNER_WARM_KEEP_ALIVE,
        "ttl_seconds": OWNER_WARM_TTL_SECONDS,
    }

def warm_owner_pool(models=None, runtime_ids=None):
    allowed = set()
    for capability in ("chat", "reasoning", "code"):
        allowed.update(allowed_models(capability))
    requested_models = list(models or configured_warm_models())
    requested_models = [str(model).strip() for model in requested_models if str(model).strip()]
    if not requested_models:
        raise ValueError("warm_models_required")
    if len(requested_models) > OWNER_WARM_MAX_MODELS:
        raise ValueError("warm_model_limit_exceeded")
    for model in requested_models:
        if model not in allowed:
            raise ValueError("warm_model_not_allowed")

    selected_ids = {str(x).strip() for x in (runtime_ids or []) if str(x).strip()}
    targets = []
    for url in owner_text_urls():
        runtime_id = owner_runtime_id(url)
        if selected_ids and runtime_id not in selected_ids:
            continue
        if owner_runtime_allowed(url):
            targets.append((runtime_id, url))
    if selected_ids and selected_ids != {runtime_id for runtime_id, _ in targets}:
        raise ValueError("warm_runtime_not_allowed")
    if not targets:
        raise RuntimeError("owner_model_pool_unconfigured")

    results = []
    for runtime_id, runtime_url in targets:
        for model in requested_models:
            ADMISSION.acquire()
            owner_pool_begin(runtime_url)
            started = time.monotonic()
            try:
                http_json(
                    runtime_url + "/api/generate",
                    {
                        "model": model,
                        "prompt": "",
                        "stream": False,
                        "keep_alive": OWNER_WARM_KEEP_ALIVE,
                    },
                    timeout=OWNER_WARM_TIMEOUT_SECONDS,
                )
                elapsed_ms = (time.monotonic() - started) * 1000.0
                owner_warm_mark(runtime_url, model, True)
                results.append({
                    "runtime_id": runtime_id,
                    "model": model,
                    "ok": True,
                    "warm_elapsed_ms": round(elapsed_ms, 2),
                })
            except Exception as exc:
                owner_warm_mark(runtime_url, model, False, exc)
                results.append({
                    "runtime_id": runtime_id,
                    "model": model,
                    "ok": False,
                    "error": str(exc)[:120],
                })
            finally:
                owner_pool_end(runtime_url)
                ADMISSION.release()
    return {
        "configured_models": requested_models,
        "attempted": len(results),
        "succeeded": sum(1 for item in results if item["ok"]),
        "failed": sum(1 for item in results if not item["ok"]),
        "results": results,
    }

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
    candidates = owner_pool_candidates(model)
    if not candidates:
        raise RuntimeError("owner_model_pool_unconfigured")
    errors = []
    for runtime_url in candidates:
        owner_pool_begin(runtime_url)
        started = time.monotonic()
        try:
            raw = http_json(
                runtime_url + "/api/chat",
                {"model": model, "stream": False, "messages": messages},
                timeout=300,
            )
            elapsed_ms = (time.monotonic() - started) * 1000.0
            if isinstance(raw, dict):
                raw["_izakhono_owner_runtime"] = owner_runtime_id(runtime_url)
                raw["_izakhono_owner_runtime_elapsed_ms"] = round(elapsed_ms, 2)
            owner_pool_mark(runtime_url, True, elapsed_ms=elapsed_ms, model=model)
            return raw
        except Exception as exc:
            owner_pool_mark(runtime_url, False, exc, model=model)
            errors.append(f"{owner_runtime_id(runtime_url)}:{type(exc).__name__}")
        finally:
            owner_pool_end(runtime_url)
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

def media_adapter_endpoint(base):
    base = str(base or "").rstrip("/")
    if not base:
        return ""
    if base.endswith("/api/v1/generate"):
        return base
    return base + "/api/v1/generate"

def media_generate(payload, model, capability):
    cfg = CAPABILITIES[capability]
    if not cfg["url"]:
        raise RuntimeError("capability_backend_unconfigured")
    if not owner_runtime_allowed(cfg["url"]):
        raise RuntimeError("owner_route_required")
    options = payload.get("options") if isinstance(payload.get("options"), dict) else {}

    if capability == "speech":
        text = str(payload.get("input") or payload.get("prompt") or options.get("text") or "").strip()
        if not text:
            raise ValueError("speech_text_required")
        request_payload = {
            "schema": "izakhono.speech.generate.v1",
            "text": text,
            "language": str(options.get("language") or payload.get("language") or "English"),
            "voice": str(options.get("voice") or payload.get("voice") or "default"),
            "format": str(options.get("format") or "wav"),
            "speed": options.get("speed", 1.0),
            "policy": {"owned_first": True, "no_tracking": True},
        }
        headers = {"x-izakhono-speech-key": cfg.get("key", "")} if cfg.get("key") else {}
        return http_json(media_adapter_endpoint(cfg["url"]), request_payload, headers=headers, timeout=300)

    if capability == "video":
        prompt = str(payload.get("prompt") or payload.get("input") or options.get("prompt") or "").strip()
        source_image = payload.get("source_image") or options.get("source_image")
        if not prompt:
            raise ValueError("video_prompt_required")
        if not source_image:
            raise ValueError("video_source_image_required")
        request_payload = {
            "schema": "izakhono.video.scene.v1",
            "prompt": prompt,
            "duration_seconds": int(options.get("duration_seconds") or payload.get("duration_seconds") or 5),
            "aspect_ratio": str(options.get("aspect_ratio") or payload.get("aspect_ratio") or "9:16"),
            "source_image": source_image,
            "policy": {"owned_first": True, "no_tracking": True, "originality_required": True},
        }
        headers = {"x-izakhono-video-key": cfg.get("key", "")} if cfg.get("key") else {}
        return http_json(media_adapter_endpoint(cfg["url"]), request_payload, headers=headers, timeout=900)

    raise RuntimeError("media_capability_invalid")

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
    messages = None
    if cfg["kind"] == "ollama_chat":
        messages = normalize_messages(payload)
        if not messages:
            raise ValueError("messages_or_input_required")
    elif cfg["kind"] == "json_generate":
        if payload.get("input") in (None, "") and payload.get("prompt") in (None, ""):
            raise ValueError("input_or_prompt_required")
    elif cfg["kind"] == "speech_generate":
        if payload.get("input") in (None, "") and payload.get("prompt") in (None, ""):
            raise ValueError("speech_text_required")
    elif cfg["kind"] == "video_generate":
        options = payload.get("options") if isinstance(payload.get("options"), dict) else {}
        if payload.get("input") in (None, "") and payload.get("prompt") in (None, ""):
            raise ValueError("video_prompt_required")
        if not (payload.get("source_image") or options.get("source_image")):
            raise ValueError("video_source_image_required")
    else:
        raise RuntimeError("capability_backend_invalid")

    ADMISSION.acquire()
    try:
        if cfg["kind"] == "ollama_chat":
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
        if cfg["kind"] in ("speech_generate", "video_generate"):
            raw = media_generate(payload, model, capability)
        else:
            raw = json_generate(payload, model, capability)
        output = raw.get("output", raw.get("result", raw))
        return capability, model, {"type": capability, "data": output}, raw, route
    finally:
        ADMISSION.release()

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
            if cfg["kind"] in ("speech_generate", "video_generate"):
                configured = bool(configured and cfg.get("key"))
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
                "admission": {
                    "max_inflight": ADMISSION.summary()["max_inflight"],
                    "max_queue": ADMISSION.summary()["max_queue"],
                    "inflight": ADMISSION.summary()["inflight"],
                    "queued": ADMISSION.summary()["queued"],
                },
                "routing": {
                    "strategy": "adaptive-ewma",
                    "ewma_alpha": OWNER_ROUTING_EWMA_ALPHA,
                    "unknown_latency_ms": OWNER_ROUTING_UNKNOWN_LATENCY_MS,
                    "inflight_penalty_ms": OWNER_ROUTING_INFLIGHT_PENALTY_MS,
                    "warm_bonus_ms": OWNER_ROUTING_WARM_BONUS_MS,
                },
                "warm_pool": warm_pool_summary(),
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
                "admission": ADMISSION.summary(),
                "routing": {
                    "strategy": "adaptive-ewma",
                    "ewma_alpha": OWNER_ROUTING_EWMA_ALPHA,
                    "unknown_latency_ms": OWNER_ROUTING_UNKNOWN_LATENCY_MS,
                    "inflight_penalty_ms": OWNER_ROUTING_INFLIGHT_PENALTY_MS,
                    "warm_bonus_ms": OWNER_ROUTING_WARM_BONUS_MS,
                },
                "warm_pool": warm_pool_summary(),
                "external_text": {
                    "enabled": external_text_configured(),
                    "provider": EXTERNAL_TEXT_PROVIDER if external_text_configured() else None,
                    "public_data_only": True,
                },
            })
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if p not in ("/api/v1/chat", "/api/v1/generate", "/api/v1/warm"):
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        if not self.authorized():
            return send_json(self, 401, {"ok": False, "error": "unauthorized"})

        try:
            payload = self.read_json()
        except Exception:
            return send_json(self, 400, {"ok": False, "error": "invalid_json"})

        if p == "/api/v1/warm":
            try:
                models = payload.get("models") if isinstance(payload.get("models"), list) else None
                runtime_ids = payload.get("runtime_ids") if isinstance(payload.get("runtime_ids"), list) else None
                result = warm_owner_pool(models=models, runtime_ids=runtime_ids)
                return send_json(self, 200, {
                    "ok": result["failed"] == 0,
                    "service": "izakhono-super-ai",
                    "operation": "warm-owner-models",
                    **result,
                })
            except ValueError as exc:
                return send_json(self, 422, {"ok": False, "error": str(exc)[:100]})
            except CapacityUnavailable as exc:
                return send_json(self, 503, {"ok": False, "error": "capacity_unavailable", "reason": str(exc)[:100], "retryable": True})
            except Exception as exc:
                return send_json(self, 502, {"ok": False, "error": "warm_pool_unavailable", "detail": str(exc)[:200]})

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
        except CapacityUnavailable as exc:
            return send_json(self, 503, {"ok": False, "error": "capacity_unavailable", "reason": str(exc)[:100], "retryable": True})
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
            "owner_runtime_elapsed_ms": _raw.get("_izakhono_owner_runtime_elapsed_ms") if route == "owned" and isinstance(_raw, dict) else None,
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
