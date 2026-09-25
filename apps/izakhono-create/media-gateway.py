#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_CREATE_MEDIA_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_CREATE_MEDIA_PORT", "9695"))
RENDER_URL = os.getenv("IZAKHONO_MEDIA_RENDER_URL", "http://127.0.0.1:9696").rstrip("/")
RENDER_KEY = os.getenv("IZAKHONO_MEDIA_INTERNAL_KEY", "")
EXTERNAL_RENDER_URL = os.getenv("IZAKHONO_MEDIA_EXTERNAL_URL", "").rstrip("/")
EXTERNAL_RENDER_KEY = os.getenv("IZAKHONO_MEDIA_EXTERNAL_KEY", "")
ALLOW_EXTERNAL_FALLBACK = os.getenv("IZAKHONO_MEDIA_ALLOW_EXTERNAL_FALLBACK", "false").lower() == "true"
ACCESS_URL = os.getenv("IZAKHONO_ACCESS_URL", "http://127.0.0.1:9494").rstrip("/")
ACCESS_KEY = os.getenv("IZAKHONO_ACCESS_INTERNAL_KEY", "")
ENTITY_ID = os.getenv("IZAKHONO_CREATE_ENTITY_ID", "izakhono-africa")
PRODUCT_SLUG = os.getenv("IZAKHONO_CREATE_PRODUCT_SLUG", "izakhono-create")
MAX_BODY = 12_000_000

FREE_MODES = {"starter_campaign", "showcase", "lifestyleshot", "metaads"}
PRO_MODES = FREE_MODES | {"campaign", "360view", "3dbillboard", "modelshot", "catalogue"}

def send_json(handler, status, payload):
    body = json.dumps(payload, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)

def post_json(url, payload, headers=None, timeout=300):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode())

def call_renderer(url, key, payload, timeout=300):
    if not url:
        raise RuntimeError("renderer_url_missing")
    headers = {}
    if key:
        headers["x-izakhono-media-key"] = key
    return post_json(url + "/api/v1/generate", payload, headers=headers, timeout=timeout)

def check_pro(subject):
    if not subject or not ACCESS_KEY:
        return False, None
    result = post_json(
        ACCESS_URL + "/api/v1/check",
        {"entity_id": ENTITY_ID, "subject": subject, "product": PRODUCT_SLUG},
        {"x-izakhono-access-key": ACCESS_KEY},
        timeout=10,
    )
    ent = result.get("entitlement") or {}
    active = bool(result.get("active"))
    plan = str(ent.get("plan") or "").lower()
    return active and plan in {"pro", "pro-monthly", "pro-annual"}, ent

def normalize_request(payload):
    plan = str(payload.get("plan") or "free").lower()
    mode = str(payload.get("mode") or "starter_campaign").lower()
    if plan not in {"free", "pro"}:
        raise ValueError("invalid_plan")
    allowed = PRO_MODES if plan == "pro" else FREE_MODES
    if mode not in allowed:
        raise ValueError("pro_required_for_mode" if plan == "free" else "invalid_mode")
    image = str(payload.get("source_image") or "")
    if not image.startswith("data:image/"):
        raise ValueError("source_image_required")
    clean = {
        "schema": "izakhono.product.media.v1",
        "plan": plan,
        "mode": mode,
        "product": str(payload.get("product") or "Untitled product")[:180],
        "category": str(payload.get("category") or "clothing")[:60],
        "ratio": str(payload.get("ratio") or "4:5")[:16],
        "brief": str(payload.get("brief") or "")[:2000],
        "direction": str(payload.get("direction") or "")[:2000],
        "source_image": image,
        "source": "IZAKHONO CREATE",
        "policy": {
            "owned_infrastructure_first": True,
            "external_fallback_reversible": True,
            "preserve_product_identity": True,
            "no_silent_tracking": True,
        },
    }
    return clean

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoCreateMediaGateway/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/media/healthz":
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-create-media-gateway",
                "owned_renderer": RENDER_URL,
                "owned_renderer_key_configured": bool(RENDER_KEY),
                "external_fallback_enabled": bool(ALLOW_EXTERNAL_FALLBACK and EXTERNAL_RENDER_URL),
                "free_modes": sorted(FREE_MODES),
                "pro_modes": sorted(PRO_MODES),
            })
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if p != "/media/api/v1/generate":
            return send_json(self, 404, {"ok": False, "error": "not_found"})

        n = int(self.headers.get("content-length", "0") or "0")
        if n <= 0 or n > MAX_BODY:
            return send_json(self, 413, {"ok": False, "error": "invalid_body_size"})
        try:
            payload = json.loads(self.rfile.read(n).decode())
            request_payload = normalize_request(payload)
        except (ValueError, json.JSONDecodeError) as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)})

        if request_payload["plan"] == "pro":
            subject = str(self.headers.get("x-izakhono-subject") or payload.get("subject") or "").strip().lower()
            try:
                entitled, entitlement = check_pro(subject)
            except Exception:
                return send_json(self, 503, {"ok": False, "error": "entitlement_service_unavailable"})
            if not entitled:
                return send_json(self, 403, {
                    "ok": False,
                    "error": "pro_entitlement_required",
                    "product": PRODUCT_SLUG,
                })
            request_payload["entitlement"] = {
                "subject": subject,
                "plan": entitlement.get("plan"),
                "expires_at": entitlement.get("expires_at"),
            }

        route = "owned"
        owned_error = None
        try:
            if not RENDER_KEY:
                raise RuntimeError("owned_renderer_key_missing")
            result = call_renderer(RENDER_URL, RENDER_KEY, request_payload, timeout=300)
        except Exception as exc:
            owned_error = str(exc)[:160]
            if not (ALLOW_EXTERNAL_FALLBACK and EXTERNAL_RENDER_URL and EXTERNAL_RENDER_KEY):
                return send_json(self, 503, {
                    "ok": False,
                    "error": "owned_renderer_unavailable",
                    "detail": owned_error,
                    "external_fallback_used": False,
                })
            route = "external-fallback"
            try:
                result = call_renderer(EXTERNAL_RENDER_URL, EXTERNAL_RENDER_KEY, request_payload, timeout=300)
            except Exception as fallback_exc:
                return send_json(self, 503, {
                    "ok": False,
                    "error": "all_renderers_unavailable",
                    "owned_detail": owned_error,
                    "fallback_detail": str(fallback_exc)[:160],
                })

        if not isinstance(result, dict) or not result.get("ok"):
            return send_json(self, 502, {"ok": False, "error": "invalid_renderer_response"})
        result["plan"] = request_payload["plan"]
        result["access_enforced"] = request_payload["plan"] == "pro"
        result["render_route"] = route
        result["owned_first"] = True
        return send_json(self, 200, result)

if __name__ == "__main__":
    print(f"IZAKHONO CREATE media gateway listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
