#!/usr/bin/env python3
"""Narrow, default-deny FORTRESS external-egress policy decision service."""

import hmac
import ipaddress
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = os.getenv("IZAKHONO_FORTRESS_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_FORTRESS_PORT", "9999"))
TOKEN = os.getenv("IZAKHONO_FORTRESS_TOKEN", "")
POLICY_PATH = Path(os.getenv("IZAKHONO_FORTRESS_POLICY", Path(__file__).with_name("policy.json")))
MAX_BODY_BYTES = 262144

FORBIDDEN_FIELDS = {
    "password", "passwd", "secret", "api_key", "apikey", "private_key",
    "access_token", "refresh_token", "authorization", "cookie",
    "card_number", "cvv", "cvc", "pin",
}


class PolicyError(ValueError):
    """Raised when policy content is absent, malformed or unsafe."""


def validate_policy(policy):
    if not isinstance(policy, dict):
        raise PolicyError("policy_must_be_object")
    if policy.get("default") != "deny":
        raise PolicyError("policy_default_must_be_deny")
    if not isinstance(policy.get("version"), int) or isinstance(policy.get("version"), bool):
        raise PolicyError("policy_version_invalid")

    principles = policy.get("principles")
    if not isinstance(principles, dict):
        raise PolicyError("policy_principles_invalid")
    for required in (
        "owner_controlled_runtime",
        "external_ai_optional_only",
        "external_ai_runtime_dependency_forbidden",
        "entity_scope_required",
        "secrets_export_forbidden",
    ):
        if principles.get(required) is not True:
            raise PolicyError("policy_principle_missing:" + required)

    data_classes = policy.get("data_classes")
    if not isinstance(data_classes, dict):
        raise PolicyError("policy_data_classes_invalid")
    for key in ("allowed_external", "forbidden_external"):
        values = data_classes.get(key)
        if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() for v in values):
            raise PolicyError("policy_" + key + "_invalid")

    external_ai = policy.get("external_ai")
    if not isinstance(external_ai, dict) or external_ai.get("mode") != "advisory_only":
        raise PolicyError("policy_external_ai_invalid")
    for key in ("allowed_purposes", "forbidden_purposes"):
        values = external_ai.get(key)
        if not isinstance(values, list) or any(not isinstance(v, str) or not v.strip() for v in values):
            raise PolicyError("policy_" + key + "_invalid")
    return policy


def load_policy():
    try:
        policy = json.loads(POLICY_PATH.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise PolicyError("policy_unavailable_or_invalid") from exc
    return validate_policy(policy)


def _contains_forbidden_field(value):
    """Iterative traversal avoids recursion-depth failures on nested JSON."""
    pending = [value]
    while pending:
        current = pending.pop()
        if isinstance(current, dict):
            for key, child in current.items():
                if str(key).casefold() in FORBIDDEN_FIELDS:
                    return True
                if isinstance(child, (dict, list)):
                    pending.append(child)
        elif isinstance(current, list):
            pending.extend(child for child in current if isinstance(child, (dict, list)))
    return False


def authorize(req, policy=None):
    """Return (allowed, reason); malformed input and policy always deny."""
    if not isinstance(req, dict):
        return False, "invalid_request"

    try:
        active_policy = validate_policy(load_policy() if policy is None else policy)
    except (PolicyError, TypeError, KeyError, AttributeError):
        return False, "policy_invalid"

    entity_id = req.get("entity_id")
    provider_class = req.get("provider_class")
    purpose = req.get("purpose")
    data_class = req.get("data_class")

    if not isinstance(entity_id, str) or not entity_id.strip():
        return False, "entity_scope_required"
    if not isinstance(provider_class, str) or not provider_class.strip():
        return False, "provider_class_not_allowlisted"
    if not isinstance(purpose, str) or not purpose.strip():
        return False, "external_ai_purpose_not_allowlisted"
    if not isinstance(data_class, str) or not data_class.strip():
        return False, "data_class_not_allowlisted"

    data_policy = active_policy["data_classes"]
    forbidden = set(data_policy["forbidden_external"])
    allowed = set(data_policy["allowed_external"])
    if data_class in forbidden:
        return False, "forbidden_data_class"
    if data_class not in allowed:
        return False, "data_class_not_allowlisted"

    if _contains_forbidden_field(req.get("payload")):
        return False, "secret_like_field_detected"

    if provider_class != "external_ai":
        return False, "provider_class_not_allowlisted"

    ai_policy = active_policy["external_ai"]
    if purpose in set(ai_policy["forbidden_purposes"]):
        return False, "forbidden_external_ai_purpose"
    if purpose not in set(ai_policy["allowed_purposes"]):
        return False, "external_ai_purpose_not_allowlisted"
    return True, "allowed_external_ai_advisory"


class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-FORTRESS"
    sys_version = ""

    def log_message(self, *_args):
        # Do not write request paths, headers or bodies to ordinary logs.
        pass

    def send_json(self, status, payload):
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def authenticated(self):
        if not TOKEN:
            return False
        supplied = self.headers.get("Authorization", "")
        return hmac.compare_digest(supplied, "Bearer " + TOKEN)

    def read_json_body(self):
        # Reject ambiguous framing rather than guessing which bytes belong to a request.
        if self.headers.get("Transfer-Encoding") is not None:
            return None, (400, "unsupported_transfer_encoding")
        lengths = self.headers.get_all("Content-Length", [])
        if len(lengths) != 1:
            return None, (411, "content_length_required")
        try:
            length = int(lengths[0], 10)
        except (TypeError, ValueError):
            return None, (400, "invalid_content_length")
        if length < 0:
            return None, (400, "invalid_content_length")
        if length > MAX_BODY_BYTES:
            return None, (413, "request_body_too_large")
        if self.headers.get_content_type() != "application/json":
            return None, (415, "application_json_required")
        raw = self.rfile.read(length)
        if len(raw) != length:
            return None, (400, "incomplete_request_body")
        try:
            value = json.loads(raw.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            return None, (400, "invalid_json")
        if not isinstance(value, dict):
            return None, (400, "json_object_required")
        return value, None

    def do_GET(self):
        if self.path == "/healthz":
            try:
                load_policy()
            except PolicyError:
                return self.send_json(503, {"ok": False, "error": "policy_unavailable"})
            return self.send_json(200, {"ok": True, "service": "izakhono-fortress", "default": "deny"})

        if self.path == "/v1/policy":
            if not self.authenticated():
                return self.send_json(401, {"error": "unauthorized"})
            try:
                policy = load_policy()
            except PolicyError:
                return self.send_json(503, {"error": "policy_unavailable"})
            return self.send_json(200, {
                "version": policy["version"],
                "default": policy["default"],
                "owner_controlled_runtime": policy["principles"]["owner_controlled_runtime"],
                "external_ai_mode": policy["external_ai"]["mode"],
            })
        return self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/v1/authorize-egress":
            return self.send_json(404, {"error": "not_found"})
        if not self.authenticated():
            return self.send_json(401, {"error": "unauthorized"})

        request, error = self.read_json_body()
        if error:
            status, code = error
            return self.send_json(status, {"error": code})

        try:
            policy = load_policy()
        except PolicyError:
            return self.send_json(503, {"error": "policy_unavailable"})

        allowed, reason = authorize(request, policy)
        return self.send_json(200 if allowed else 403, {"allowed": allowed, "reason": reason})


def validate_bind_address(host):
    try:
        address = ipaddress.ip_address(host)
    except ValueError as exc:
        raise SystemExit("FORTRESS must bind to an IPv4 loopback address") from exc
    if address.version != 4 or not address.is_loopback:
        raise SystemExit("FORTRESS must bind to an IPv4 loopback address")


if __name__ == "__main__":
    if not TOKEN:
        raise SystemExit("IZAKHONO_FORTRESS_TOKEN is required")
    validate_bind_address(HOST)
    if not 1 <= PORT <= 65535:
        raise SystemExit("IZAKHONO_FORTRESS_PORT must be between 1 and 65535")
    print(f"IZAKHONO FORTRESS listening on {HOST}:{PORT} with default-deny egress policy")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
