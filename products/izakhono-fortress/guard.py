#!/usr/bin/env python3
import hmac
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = os.getenv("IZAKHONO_FORTRESS_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_FORTRESS_PORT", "9999"))
TOKEN = os.getenv("IZAKHONO_FORTRESS_TOKEN", "")
POLICY_PATH = Path(os.getenv("IZAKHONO_FORTRESS_POLICY", Path(__file__).with_name("policy.json")))
MAX_BODY = 262144
logging.basicConfig(level=os.getenv("IZAKHONO_FORTRESS_LOG_LEVEL", "INFO"))
logger = logging.getLogger("izakhono.fortress")

FORBIDDEN_FIELDS = {
    "password", "passwd", "secret", "api_key", "apikey", "private_key", "access_token",
    "refresh_token", "authorization", "cookie", "card_number", "cvv", "cvc", "pin"
}


def load_policy():
    return json.loads(POLICY_PATH.read_text(encoding="utf-8"))


def _contains_forbidden_field(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in FORBIDDEN_FIELDS or _contains_forbidden_field(child):
                return True
    elif isinstance(value, list):
        return any(_contains_forbidden_field(child) for child in value)
    return False


def authorize(req, policy=None):
    policy = policy or load_policy()
    if not isinstance(req, dict):
        return False, "invalid_request"
    entity_id = str(req.get("entity_id") or "").strip()
    provider_class = str(req.get("provider_class") or "").strip()
    purpose = str(req.get("purpose") or "").strip()
    data_class = str(req.get("data_class") or "").strip()
    payload = req.get("payload")

    if not entity_id:
        return False, "entity_scope_required"
    forbidden = set(policy["data_classes"]["forbidden_external"])
    allowed = set(policy["data_classes"]["allowed_external"])
    if data_class in forbidden:
        return False, "forbidden_data_class"
    if data_class not in allowed:
        return False, "data_class_not_allowlisted"
    if _contains_forbidden_field(payload):
        return False, "secret_like_field_detected"
    if provider_class == "external_ai":
        ai = policy["external_ai"]
        if purpose in ai["forbidden_purposes"]:
            return False, "forbidden_external_ai_purpose"
        if purpose not in ai["allowed_purposes"]:
            return False, "external_ai_purpose_not_allowlisted"
        return True, "allowed_external_ai_advisory"
    return False, "provider_class_not_allowlisted"


def authorize_product(req, policy=None):
    """Exact-match product permission policy. No wildcard or role inheritance."""
    policy = policy or load_policy()
    if not isinstance(req, dict):
        return False, "invalid_request"
    fields = ("subject", "entity_id", "role", "product", "permission")
    values = {key: req.get(key) for key in fields}
    if any(not isinstance(value, str) or not value.strip() for value in values.values()):
        return False, "product_permission_scope_incomplete"
    rules = policy.get("product_permissions", {}).get(values["product"], [])
    if not isinstance(rules, list):
        return False, "product_policy_invalid"
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        if all(rule.get(key) == values[key] for key in ("subject", "entity_id", "role")):
            permissions = rule.get("permissions")
            if isinstance(permissions, list) and values["permission"] in permissions:
                return True, "explicit_product_permission_granted"
    return False, "product_permission_not_allowlisted"


class H(BaseHTTPRequestHandler):
    def log_message(self, *args):
        return

    def sendj(self, code, obj):
        body = json.dumps(obj, separators=(",", ":")).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authed(self):
        return bool(TOKEN) and hmac.compare_digest(
            self.headers.get("Authorization", ""), "Bearer " + TOKEN
        )

    def do_GET(self):
        if self.path == "/healthz":
            return self.sendj(200, {"ok": True, "service": "izakhono-fortress", "default": "deny", "host": HOST})
        if self.path == "/v1/policy":
            if not self.authed():
                return self.sendj(401, {"error": "unauthorized"})
            policy = load_policy()
            return self.sendj(200, {
                "version": policy["version"],
                "default": policy["default"],
                "owner_controlled_runtime": policy["principles"]["owner_controlled_runtime"],
                "external_ai_mode": policy["external_ai"]["mode"],
                "product_permission_products": sorted(policy.get("product_permissions", {}).keys())
            })
        return self.sendj(404, {"error": "not_found"})

    def _read_json(self):
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return None, "invalid_content_length"
        if length <= 0 or length > MAX_BODY:
            return None, "invalid_body_size"
        try:
            value = json.loads(self.rfile.read(length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            return None, "invalid_json"
        return value, None

    def do_POST(self):
        routes = {
            "/v1/authorize-egress": authorize,
            "/v1/authorize-product": authorize_product
        }
        decision = routes.get(self.path)
        if decision is None:
            return self.sendj(404, {"error": "not_found"})
        if not self.authed():
            return self.sendj(401, {"error": "unauthorized"})
        req, error = self._read_json()
        if error:
            return self.sendj(400, {"error": error})
        try:
            allowed, reason = decision(req)
        except Exception:
            logger.exception("policy_decision_error route=%s", self.path)
            return self.sendj(503, {"allowed": False, "reason": "policy_decision_unavailable"})
        decision_id = "fdc_" + uuid.uuid4().hex
        logger.info(json.dumps({
            "event": "fortress_policy_decision",
            "decision_id": decision_id,
            "route": self.path,
            "allowed": allowed,
            "reason": reason,
            "at": datetime.now(timezone.utc).isoformat()
        }, separators=(",", ":")))
        return self.sendj(200 if allowed else 403, {
            "decision_id": decision_id,
            "policy_version": load_policy()["version"],
            "allowed": allowed,
            "reason": reason
        })


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("IZAKHONO_FORTRESS_TOKEN is required")
    print("IZAKHONO FORTRESS listening on " + HOST + ":" + str(PORT) + " with default-deny policy")
    ThreadingHTTPServer((HOST, PORT), H).serve_forever()
