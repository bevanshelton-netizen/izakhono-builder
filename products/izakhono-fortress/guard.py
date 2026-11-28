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


import re

PERMISSION_PATTERN = re.compile(r"^[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*){1,3}$")


def validate_policy(policy):
    """Reject unsafe or ambiguous policy documents before any decision."""
    if not isinstance(policy, dict):
        raise ValueError("policy_must_be_object")
    if type(policy.get("version")) is not int or policy["version"] < 1:
        raise ValueError("policy_version_invalid")
    if policy.get("default") != "deny":
        raise ValueError("policy_default_must_deny")
    product_map = policy.get("product_permissions")
    if not isinstance(product_map, dict):
        raise ValueError("product_permissions_must_be_object")
    for product, rules in product_map.items():
        if not isinstance(product, str) or not product or product.strip() != product:
            raise ValueError("product_identifier_invalid")
        if not isinstance(rules, list):
            raise ValueError("product_rules_must_be_list")
        seen = set()
        for rule in rules:
            if not isinstance(rule, dict) or set(rule) != {"subject", "entity_id", "role", "permissions"}:
                raise ValueError("product_rule_shape_invalid")
            identity = tuple(rule.get(k) for k in ("subject", "entity_id", "role"))
            if any(not isinstance(v, str) or not v.strip() or v.strip() != v or v == "*" for v in identity):
                raise ValueError("product_rule_identity_invalid")
            if identity in seen:
                raise ValueError("duplicate_product_rule")
            seen.add(identity)
            permissions = rule.get("permissions")
            if not isinstance(permissions, list) or not permissions:
                raise ValueError("product_rule_permissions_required")
            if any(not isinstance(p, str) or not PERMISSION_PATTERN.fullmatch(p) for p in permissions):
                raise ValueError("product_permission_identifier_invalid")
            if len(set(permissions)) != len(permissions):
                raise ValueError("duplicate_product_permission")
    return policy


def load_policy():
    return validate_policy(json.loads(POLICY_PATH.read_text(encoding="utf-8")))


def _contains_forbidden_field(value):
    if isinstance(value, dict):
        for key, child in value.items():
            if str(key).lower() in FORBIDDEN_FIELDS or _contains_forbidden_field(child):
                return True
    elif isinstance(value, list):
        return any(_contains_forbidden_field(child) for child in value)
    return False


def authorize(req, policy=None):
    policy = validate_policy(policy if policy is not None else load_policy())
    if not isinstance(req, dict):
        return False, "invalid_request"
    entity_id = str(req.get("entity_id") or "").strip()
    provider_class = str(req.get("provider_class") or "").strip()
    purpose = str(req.get("purpose") or "").strip()
    data_class = str(req.get("data_class") or "").strip()
    payload = req.get("payload")

    if not entity_id:
        return False, "entity_scope_required"
    classes = policy.get("data_classes", {})
    if not isinstance(classes, dict):
        return False, "policy_data_classes_invalid"
    forbidden = set(classes.get("forbidden_external", []))
    allowed = set(classes.get("allowed_external", []))
    if data_class in forbidden:
        return False, "forbidden_data_class"
    if data_class not in allowed:
        return False, "data_class_not_allowlisted"
    if _contains_forbidden_field(payload):
        return False, "secret_like_field_detected"
    if provider_class == "external_ai":
        ai = policy.get("external_ai", {})
        if purpose in ai.get("forbidden_purposes", []):
            return False, "forbidden_external_ai_purpose"
        if purpose not in ai.get("allowed_purposes", []):
            return False, "external_ai_purpose_not_allowlisted"
        return True, "allowed_external_ai_advisory"
    return False, "provider_class_not_allowlisted"


def authorize_product(req, policy=None):
    """Exact-match product permission policy. No wildcard or role inheritance."""
    policy = validate_policy(policy if policy is not None else load_policy())
    if not isinstance(req, dict):
        return False, "invalid_request"
    fields = ("subject", "entity_id", "role", "product", "permission")
    values = {key: req.get(key) for key in fields}
    if any(not isinstance(value, str) or not value.strip() or value.strip() != value for value in values.values()):
        return False, "product_permission_scope_incomplete"
    if not PERMISSION_PATTERN.fullmatch(values["permission"]):
        return False, "product_permission_identifier_invalid"
    rules = policy["product_permissions"].get(values["product"], [])
    for rule in rules:
        if all(rule[key] == values[key] for key in ("subject", "entity_id", "role")):
            if values["permission"] in rule["permissions"]:
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
