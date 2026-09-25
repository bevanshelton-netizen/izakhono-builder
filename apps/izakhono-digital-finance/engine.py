#!/usr/bin/env python3
"""
IZAKHONO Digital Finance Academy
Independent, dependency-free HTTP engine for NODE01 and portable container deployment.

The engine deliberately contains no analytics SDK, tracking pixel, advertising identifier,
third-party authentication dependency or payment credential. Paid checkout stays gated
until a product-specific iKhokha route is verified end-to-end.
"""

from __future__ import annotations

import hmac
import json
import mimetypes
import os

from assessment_service import AssessmentService
from automation_engine import evaluate as evaluate_automation
from automation_store import AutomationStore
from credential_service import issue_completion_record, verify_completion_record
from learner_access import issue_token as issue_learner_token
from learner_access import verify_token as verify_learner_token
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

ROOT = Path(__file__).resolve().parent
HOST = os.getenv("IZAKHONO_DF_HOST", "0.0.0.0")
PORT = int(os.getenv("IZAKHONO_DF_PORT", "8080"))
STATE_DB = os.getenv("IZAKHONO_DF_STATE_DB", str(ROOT / ".data" / "izakhono-df.sqlite3"))
ADMIN_TOKEN = os.getenv("IZAKHONO_DF_ADMIN_TOKEN", "")
LEARNER_SIGNING_KEY = os.getenv("IZAKHONO_DF_LEARNER_SIGNING_KEY", "")
CREDENTIAL_SIGNING_KEY = os.getenv("IZAKHONO_DF_CREDENTIAL_SIGNING_KEY", "")
QUESTION_BANK = os.getenv("IZAKHONO_DF_QUESTION_BANK", "")
STORE = AutomationStore(STATE_DB)
ASSESSMENTS = AssessmentService(QUESTION_BANK) if QUESTION_BANK else None

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": (
        "camera=(), microphone=(), geolocation=(), payment=(), "
        "usb=(), bluetooth=(), interest-cohort=()"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}


def read_json(name: str) -> dict:
    with (ROOT / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


class AcademyHandler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-Digital-Finance/1.0"

    def log_message(self, fmt: str, *args) -> None:
        # Operational request logging only. No cookies, fingerprinting or analytics IDs.
        super().log_message(fmt, *args)

    def _headers(
        self,
        status: int,
        content_type: str,
        length: int | None = None,
        cache_control: str = "no-store",
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", cache_control)
        for key, value in SECURITY_HEADERS.items():
            self.send_header(key, value)
        if length is not None:
            self.send_header("Content-Length", str(length))
        self.end_headers()

    def _json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self._headers(status, "application/json; charset=utf-8", len(body))
        if self.command != "HEAD":
            self.wfile.write(body)

    def _text(
        self,
        body: str,
        status: int = HTTPStatus.OK,
        content_type: str = "text/plain; charset=utf-8",
    ) -> None:
        encoded = body.encode("utf-8")
        self._headers(status, content_type, len(encoded))
        if self.command != "HEAD":
            self.wfile.write(encoded)

    def _admin_authorized(self) -> bool:
        if not ADMIN_TOKEN:
            self._json(
                {
                    "error": "protected_admin_adapter_not_configured",
                    "message": "Set IZAKHONO_DF_ADMIN_TOKEN before enabling institutional stateful administration.",
                },
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return False

        supplied = self.headers.get("Authorization", "")
        expected = "Bearer " + ADMIN_TOKEN
        if not hmac.compare_digest(supplied, expected):
            self._json(
                {"error": "unauthorized", "message": "Valid institutional admin authorization is required."},
                HTTPStatus.UNAUTHORIZED,
            )
            return False
        return True

    def _learner_claims(self) -> dict | None:
        if not LEARNER_SIGNING_KEY:
            self._json(
                {
                    "error": "learner_access_not_configured",
                    "message": "Set IZAKHONO_DF_LEARNER_SIGNING_KEY before enabling learner access.",
                },
                HTTPStatus.SERVICE_UNAVAILABLE,
            )
            return None

        supplied = self.headers.get("Authorization", "")
        if not supplied.startswith("Bearer "):
            self._json(
                {"error": "unauthorized", "message": "Learner bearer token required."},
                HTTPStatus.UNAUTHORIZED,
            )
            return None

        try:
            claims = verify_learner_token(LEARNER_SIGNING_KEY, supplied[7:])
        except ValueError as exc:
            self._json({"error": "unauthorized", "message": str(exc)}, HTTPStatus.UNAUTHORIZED)
            return None

        try:
            learner = STORE.get_learner(claims["institution_ref"], claims["sub"])
        except ValueError:
            self._json({"error": "unauthorized", "message": "Learner is not provisioned."}, HTTPStatus.UNAUTHORIZED)
            return None

        if learner["role"] != claims.get("role"):
            self._json({"error": "unauthorized", "message": "Learner role changed; request a new access token."}, HTTPStatus.UNAUTHORIZED)
            return None
        return claims

    def _read_json_body(self, max_bytes: int = 32768) -> dict | None:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0

        if length <= 0 or length > max_bytes:
            self._json(
                {
                    "error": "invalid_request_size",
                    "message": "Request body must be a small JSON object.",
                },
                HTTPStatus.BAD_REQUEST,
            )
            return None

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            self._json(
                {"error": "invalid_json", "message": "Request body must be valid JSON."},
                HTTPStatus.BAD_REQUEST,
            )
            return None

        if not isinstance(payload, dict):
            self._json(
                {"error": "invalid_payload", "message": "Request body must be a JSON object."},
                HTTPStatus.BAD_REQUEST,
            )
            return None
        return payload

    def _serve_file(self, request_path: str) -> None:
        relative = unquote(request_path.lstrip("/")) or "index.html"
        candidate = (ROOT / relative).resolve()

        try:
            candidate.relative_to(ROOT)
        except ValueError:
            self._text("Not found\n", HTTPStatus.NOT_FOUND)
            return

        if candidate.is_dir():
            candidate = candidate / "index.html"

        if not candidate.is_file():
            self._text("Not found\n", HTTPStatus.NOT_FOUND)
            return

        content = candidate.read_bytes()
        content_type, _ = mimetypes.guess_type(str(candidate))
        content_type = content_type or "application/octet-stream"
        if content_type.startswith("text/") or candidate.suffix in {".js", ".json"}:
            content_type += "; charset=utf-8"

        immutable = candidate.suffix in {".css", ".js"}
        cache = "public, max-age=300" if immutable else "no-store"
        self._headers(HTTPStatus.OK, content_type, len(content), cache)
        if self.command != "HEAD":
            self.wfile.write(content)

    def _route(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/healthz":
            self._text("OK\n")
            return

        if path == "/api/v1/status":
            self._json(
                {
                    "service": "izakhono-digital-finance",
                    "product": "IZAKHONO Digital Finance Academy",
                    "operator": "IZAKHONO AFRICA (PTY) LTD",
                    "engine": "independent",
                    "mode": "owned-engine",
                    "status": "BUILT / VERIFIED LOCALLY",
                    "tracking": False,
                    "analytics": False,
                    "automation": {
                        "state": "ZERO_TOUCH_CORE_BUILT_VERIFIED_LOCALLY_PROTECTED_RUNTIME_CONFIGURATION_REQUIRED",
                        "routine_admin_target": "90-95%",
                        "decision_endpoint": "/api/v1/automation/evaluate",
                        "institutional_event_endpoint": "/api/v1/admin/automation/event",
                        "state_store": "SQLite pseudonymous learner state + event/outbox store",
                        "admin_auth_required": True,
                        "learner_access_tokens": bool(LEARNER_SIGNING_KEY),
                        "assessment_bank_configured": bool(ASSESSMENTS and ASSESSMENTS.available()),
                        "completion_record_signing": bool(CREDENTIAL_SIGNING_KEY),
                        "human_governance": True,
                    },
                    "payment": {
                        "gateway": "iKhokha",
                        "state": "GATED_PENDING_VERIFIED_PRODUCT_CHECKOUT",
                    },
                }
            )
            return

        if path == "/api/v1/catalog":
            self._json(read_json("curriculum.json"))
            return

        if path == "/api/v1/platform":
            self._json(read_json("platform.json"))
            return

        if path == "/api/v1/institutions":
            self._json(read_json("institutions.json"))
            return

        if path == "/api/v1/locales":
            self._json(read_json("locales.json"))
            return

        if path == "/api/v1/offers":
            self._json(read_json("institutional-offers.json"))
            return

        if path == "/api/v1/automation":
            self._json(read_json("automation.json"))
            return

        if path == "/api/v1/assessment-blueprint":
            self._json(read_json("assessment-blueprint.json"))
            return

        if path == "/api/v1/admin/automation/report":
            if not self._admin_authorized():
                return
            institution_ref = (query.get("institution_ref") or [""])[0]
            try:
                self._json(STORE.report(institution_ref))
            except ValueError as exc:
                self._json({"error": "invalid_request", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/admin/automation/outbox":
            if not self._admin_authorized():
                return
            institution_ref = (query.get("institution_ref") or [""])[0]
            try:
                limit = int((query.get("limit") or ["100"])[0])
                self._json(
                    {
                        "institution_ref": institution_ref,
                        "actions": STORE.pending_actions(institution_ref, limit),
                    }
                )
            except (ValueError, TypeError) as exc:
                self._json({"error": "invalid_request", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/learner/me":
            claims = self._learner_claims()
            if claims is None:
                return
            try:
                learner = STORE.get_learner(claims["institution_ref"], claims["sub"])
                self._json(
                    {
                        "learner_ref": learner["learner_ref"],
                        "institution_ref": learner["institution_ref"],
                        "role": learner["role"],
                        "stage": learner["stage"],
                        "learning_path": learner["learning_path"],
                        "completed_modules": learner["completed_modules"],
                        "total_modules": learner["total_modules"],
                        "human_review": learner["human_review"],
                    }
                )
            except ValueError as exc:
                self._json({"error": "not_found", "message": str(exc)}, HTTPStatus.NOT_FOUND)
            return

        if path == "/api/v1/learner/actions":
            claims = self._learner_claims()
            if claims is None:
                return
            self._json(
                {
                    "learner_ref": claims["sub"],
                    "actions": STORE.learner_actions(claims["institution_ref"], claims["sub"]),
                }
            )
            return

        if path == "/api/v1/learner/assessment":
            claims = self._learner_claims()
            if claims is None:
                return
            assessment_id = (query.get("assessment_id") or [""])[0]
            if not ASSESSMENTS or not ASSESSMENTS.available():
                self._json(
                    {"error": "assessment_bank_not_configured"},
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return
            try:
                self._json(ASSESSMENTS.present(assessment_id))
            except ValueError as exc:
                self._json({"error": "assessment_unavailable", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/learner/completion-record":
            claims = self._learner_claims()
            if claims is None:
                return
            if not CREDENTIAL_SIGNING_KEY:
                self._json(
                    {"error": "credential_signing_not_configured"},
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return
            programme_id = (query.get("programme_id") or ["fais-employee-empowerment"])[0]
            try:
                learner = STORE.get_learner(claims["institution_ref"], claims["sub"])
                if learner["last_decision"] not in {"completion_eligible", "certificate_eligible", "complete"}:
                    self._json(
                        {"error": "completion_not_eligible", "stage": learner["stage"]},
                        HTTPStatus.CONFLICT,
                    )
                    return
                record = issue_completion_record(
                    CREDENTIAL_SIGNING_KEY,
                    learner_ref=claims["sub"],
                    institution_ref=claims["institution_ref"],
                    programme_id=programme_id,
                )
                verified = verify_completion_record(CREDENTIAL_SIGNING_KEY, record)
                STORE.store_credential(
                    credential_ref=verified["credential_ref"],
                    institution_ref=claims["institution_ref"],
                    learner_ref=claims["sub"],
                    programme_id=programme_id,
                    record_token=record,
                )
                self._json({"record": record, "credential": verified})
            except ValueError as exc:
                self._json({"error": "completion_record_error", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/completion/verify":
            record = (query.get("record") or [""])[0]
            if not CREDENTIAL_SIGNING_KEY:
                self._json(
                    {"error": "credential_signing_not_configured"},
                    HTTPStatus.SERVICE_UNAVAILABLE,
                )
                return
            try:
                self._json({"valid": True, "credential": verify_completion_record(CREDENTIAL_SIGNING_KEY, record)})
            except ValueError as exc:
                self._json({"valid": False, "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/payment":
            self._json(
                {
                    "enabled": False,
                    "gateway": "iKhokha",
                    "reason": "Product-specific checkout and entitlement flow are not yet verified end-to-end.",
                }
            )
            return

        self._serve_file(path)

    def do_GET(self) -> None:  # noqa: N802
        self._route()

    def do_HEAD(self) -> None:  # noqa: N802
        self._route()

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path

        if path == "/api/v1/automation/evaluate":
            payload = self._read_json_body()
            if payload is None:
                return
            decision = evaluate_automation(payload, read_json("automation.json"))
            status = HTTPStatus.OK if decision.get("ok") else HTTPStatus.BAD_REQUEST
            self._json(decision, status)
            return

        if path == "/api/v1/admin/institution/license":
            if not self._admin_authorized():
                return
            payload = self._read_json_body()
            if payload is None:
                return
            try:
                license_data = STORE.set_institution_license(
                    str(payload.get("institution_ref") or ""),
                    active=bool(payload.get("active", True)),
                    seat_limit=int(payload.get("seat_limit") or 0),
                    product_id=str(payload.get("product_id") or "fais-employee-empowerment"),
                    price_per_employee=int(payload.get("price_per_employee") or 1000),
                )
                self._json({"ok": True, "license": license_data})
            except (ValueError, TypeError) as exc:
                self._json({"error": "invalid_license", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/admin/roster/provision":
            if not self._admin_authorized():
                return
            payload = self._read_json_body(max_bytes=1024 * 1024)
            if payload is None:
                return
            try:
                result = STORE.provision_roster(
                    str(payload.get("institution_ref") or ""),
                    payload.get("learners") or [],
                )
                self._json({"ok": True, "result": result})
            except ValueError as exc:
                self._json({"error": "roster_error", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/admin/learner/access-token":
            if not self._admin_authorized():
                return
            payload = self._read_json_body()
            if payload is None:
                return
            if not LEARNER_SIGNING_KEY:
                self._json({"error": "learner_access_not_configured"}, HTTPStatus.SERVICE_UNAVAILABLE)
                return
            institution_ref = str(payload.get("institution_ref") or "")
            learner_ref = str(payload.get("learner_ref") or "")
            try:
                learner = STORE.get_learner(institution_ref, learner_ref)
                token = issue_learner_token(
                    LEARNER_SIGNING_KEY,
                    learner_ref=learner_ref,
                    institution_ref=institution_ref,
                    role=learner["role"],
                    ttl_seconds=int(payload.get("ttl_seconds") or 8 * 60 * 60),
                )
                self._json({"ok": True, "access_token": token, "expires_in": int(payload.get("ttl_seconds") or 8 * 60 * 60)})
            except (ValueError, TypeError) as exc:
                self._json({"error": "access_token_error", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/learner/assessment/submit":
            claims = self._learner_claims()
            if claims is None:
                return
            payload = self._read_json_body()
            if payload is None:
                return
            if not ASSESSMENTS or not ASSESSMENTS.available():
                self._json({"error": "assessment_bank_not_configured"}, HTTPStatus.SERVICE_UNAVAILABLE)
                return
            assessment_id = str(payload.get("assessment_id") or "")
            answers = payload.get("answers") or {}
            if not isinstance(answers, dict):
                self._json({"error": "answers_must_be_object"}, HTTPStatus.BAD_REQUEST)
                return
            try:
                scored = ASSESSMENTS.score(assessment_id, answers)
                learner = STORE.get_learner(claims["institution_ref"], claims["sub"])
                assessment = ASSESSMENTS.present(assessment_id)
                event = {
                    "institution_ref": claims["institution_ref"],
                    "learner_ref": claims["sub"],
                    "role": learner["role"],
                    "stage": "baseline" if assessment["type"] == "baseline" else "final_assessment",
                }
                if assessment["type"] == "baseline":
                    event["baseline_score"] = scored["percent"]
                else:
                    event["final_score"] = scored["percent"]
                    event["attempts"] = learner["attempts"] + 1
                decision_payload = {key: value for key, value in event.items() if key != "institution_ref"}
                decision = evaluate_automation(decision_payload, read_json("automation.json"))
                stored = STORE.record_decision(event, decision)
                self._json(
                    {
                        "ok": True,
                        "score": scored,
                        "decision": decision,
                        "stored": stored,
                    }
                )
            except ValueError as exc:
                self._json({"error": "assessment_error", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
            return

        if path == "/api/v1/admin/automation/event":
            if not self._admin_authorized():
                return
            payload = self._read_json_body()
            if payload is None:
                return

            institution_ref = payload.get("institution_ref")
            decision_payload = {key: value for key, value in payload.items() if key != "institution_ref"}
            decision = evaluate_automation(decision_payload, read_json("automation.json"))
            if not decision.get("ok"):
                self._json(decision, HTTPStatus.BAD_REQUEST)
                return

            try:
                stored = STORE.record_decision(payload, decision)
            except ValueError as exc:
                self._json({"error": "invalid_request", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
                return

            self._json(
                {
                    "ok": True,
                    "institution_ref": institution_ref,
                    "decision": decision,
                    "stored": stored,
                }
            )
            return

        if path == "/api/v1/admin/automation/outbox/ack":
            if not self._admin_authorized():
                return
            payload = self._read_json_body()
            if payload is None:
                return
            institution_ref = payload.get("institution_ref")
            action_id = payload.get("action_id")
            try:
                if not institution_ref or action_id is None:
                    raise ValueError("institution_ref_and_action_id_required")
                acknowledged = STORE.ack_action(str(institution_ref), int(action_id))
            except (ValueError, TypeError) as exc:
                self._json({"error": "invalid_request", "message": str(exc)}, HTTPStatus.BAD_REQUEST)
                return

            self._json({"ok": True, "acknowledged": acknowledged})
            return

        self._json(
            {
                "error": "write_route_not_enabled",
                "message": "Customer PII and payment write routes remain disabled. Only pseudonymous workforce-automation administration routes are enabled.",
            },
            HTTPStatus.METHOD_NOT_ALLOWED,
        )


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), AcademyHandler)
    print(f"IZAKHONO Digital Finance engine listening on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
