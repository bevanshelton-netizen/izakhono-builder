#!/usr/bin/env python3
import json
import os
import urllib.error
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_CREATE_COMMERCE_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_CREATE_COMMERCE_PORT", "9694"))
PAY_URL = os.getenv("IZAKHONO_PAY_URL", "http://127.0.0.1:8787").rstrip("/")
PAY_KEY = os.getenv("IZAKHONO_PAY_INTERNAL_API_KEY", "")
PUBLIC_ORIGIN = os.getenv("IZAKHONO_CREATE_PUBLIC_ORIGIN", "").rstrip("/")
PRO_AMOUNT_MINOR_ZAR = int(os.getenv("IZAKHONO_CREATE_PRO_AMOUNT_MINOR_ZAR", "0") or "0")
MAX_BODY = 20_000

def send_json(handler, status, payload):
    body = json.dumps(payload, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)

def valid_email(value):
    value = str(value or "").strip().lower()
    return value if "@" in value and "." in value.split("@")[-1] and len(value) <= 254 else ""

def post_json(url, payload, headers=None, timeout=30):
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return res.status, json.loads(res.read().decode())

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoCreateCommerceGateway/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/create/commerce/healthz":
            ready = bool(PAY_KEY and PUBLIC_ORIGIN.startswith("https://") and PRO_AMOUNT_MINOR_ZAR >= 100)
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-create-commerce-gateway",
                "pro_checkout_configured": ready,
                "currency": "ZAR",
                "display_plan": "US$5/month",
            })
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        p = urlparse(self.path).path
        if p != "/create/api/v1/checkout/pro":
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        if not PAY_KEY or not PUBLIC_ORIGIN.startswith("https://") or PRO_AMOUNT_MINOR_ZAR < 100:
            return send_json(self, 503, {"ok": False, "error": "pro_checkout_not_configured"})

        n = int(self.headers.get("content-length", "0") or "0")
        if n <= 0 or n > MAX_BODY:
            return send_json(self, 400, {"ok": False, "error": "invalid_body_size"})
        try:
            payload = json.loads(self.rfile.read(n).decode())
        except Exception:
            return send_json(self, 400, {"ok": False, "error": "invalid_json"})

        email = valid_email(payload.get("email"))
        if not email:
            return send_json(self, 422, {"ok": False, "error": "valid_email_required"})

        checkout_id = uuid.uuid4().hex
        body = {
            "amount_minor": PRO_AMOUNT_MINOR_ZAR,
            "currency": "ZAR",
            "email": email,
            "description": "IZAKHONO CREATE Pro — monthly",
            "provider": "ikhokha",
            "return_url": PUBLIC_ORIGIN + "/product-ai.html?payment=success",
            "cancel_url": PUBLIC_ORIGIN + "/product-ai.html?payment=cancelled",
            "metadata": {
                "access_entity_id": "izakhono-africa",
                "access_subject": email,
                "access_product": "izakhono-create",
                "access_plan": "pro-monthly",
                "access_period_days": 30,
                "customer_email": email,
                "display_price": "US$5/month",
            },
        }
        headers = {
            "x-izakhono-key": PAY_KEY,
            "x-izakhono-app": "izakhono-create",
            "idempotency-key": "create-pro-" + checkout_id,
        }
        try:
            status, result = post_json(PAY_URL + "/api/v1/intents", body, headers=headers)
        except urllib.error.HTTPError as exc:
            try:
                detail = json.loads(exc.read().decode())
            except Exception:
                detail = {}
            return send_json(self, 502, {"ok": False, "error": "payment_gateway_rejected", "detail": detail})
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": "payment_gateway_unavailable", "detail": str(exc)[:160]})

        intent = result.get("intent") or {}
        checkout_url = intent.get("checkout_url")
        if status not in (200, 201) or not checkout_url:
            return send_json(self, 502, {"ok": False, "error": "checkout_url_missing"})
        return send_json(self, 201, {
            "ok": True,
            "checkout_url": checkout_url,
            "checkout_method": intent.get("checkout_method"),
            "reference": intent.get("reference"),
            "provider": "ikhokha",
        })

if __name__ == "__main__":
    print(f"IZAKHONO CREATE commerce gateway listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
