"""Minimal server-side HTTP transport for the documented Regula IDV API.

This client deliberately returns raw session payloads. Workflow status and check
mapping belong in a separately reviewed adapter because they are tenant-specific.
"""
from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


class RegulaConfigurationError(RuntimeError):
    pass


class RegulaAPIError(RuntimeError):
    pass


@dataclass(frozen=True)
class RegulaIDVConfig:
    base_url: str
    api_key: str
    workflow_id: str
    locale: str = "en-us"
    ttl_seconds: int = 1800
    timeout_seconds: float = 15.0

    @classmethod
    def from_env(cls) -> "RegulaIDVConfig":
        base_url = os.environ.get("IZAKHONO_REGULA_BASE_URL", "").strip().rstrip("/")
        api_key = os.environ.get("IZAKHONO_REGULA_API_KEY", "").strip()
        workflow_id = os.environ.get("IZAKHONO_REGULA_WORKFLOW_ID", "").strip()
        locale = os.environ.get("IZAKHONO_REGULA_LOCALE", "en-us").strip()
        try:
            ttl = int(os.environ.get("IZAKHONO_REGULA_SESSION_TTL_SECONDS", "1800"))
            timeout = float(os.environ.get("IZAKHONO_REGULA_TIMEOUT_SECONDS", "15"))
        except ValueError as exc:
            raise RegulaConfigurationError("invalid_regula_numeric_configuration") from exc

        parsed = urllib.parse.urlsplit(base_url)
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise RegulaConfigurationError("regula_base_url_must_be_https")
        if parsed.query or parsed.fragment:
            raise RegulaConfigurationError("regula_base_url_must_not_contain_query_or_fragment")
        if not api_key or not workflow_id:
            raise RegulaConfigurationError("regula_api_key_and_workflow_id_required")
        if not re.fullmatch(r"[A-Za-z0-9._:-]{1,200}", workflow_id):
            raise RegulaConfigurationError("invalid_regula_workflow_id")
        if not 60 <= ttl <= 3600 or not 1 <= timeout <= 60:
            raise RegulaConfigurationError("regula_ttl_or_timeout_out_of_range")
        return cls(base_url, api_key, workflow_id, locale, ttl, timeout)


class RegulaIDVHttpClient:
    """Server-only client for documented token-URL start and session retrieval."""

    def __init__(self, config: RegulaIDVConfig):
        self.config = config

    def _request(self, method: str, path: str, body: dict[str, Any] | None = None) -> dict[str, Any]:
        url = self.config.base_url + path
        headers = {
            "Accept": "application/json",
            "Authorization": "ApiKey " + self.config.api_key,
        }
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(request, timeout=self.config.timeout_seconds) as response:
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    raise RegulaAPIError("regula_response_too_large")
                parsed = json.loads(raw.decode("utf-8"))
                if not isinstance(parsed, dict):
                    raise RegulaAPIError("regula_response_invalid_shape")
                return parsed
        except urllib.error.HTTPError as exc:
            # Never include vendor response bodies or credentials in exception text.
            raise RegulaAPIError("regula_http_error_" + str(exc.code)) from None
        except urllib.error.URLError:
            raise RegulaAPIError("regula_connection_error") from None
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise RegulaAPIError("regula_response_invalid_json") from None
        except TimeoutError:
            raise RegulaAPIError("regula_timeout") from None

    def start_session(self, *, entity_ref: str, subject_ref_hash: str, purpose: str,
                      jurisdiction: str, notice_version: str,
                      idempotency_key_hash: str | None = None) -> dict[str, Any]:
        """Create a hosted hand-off URL; caller must return it only to authorized subject."""
        values = (entity_ref, subject_ref_hash, purpose, jurisdiction, notice_version)
        if not all(isinstance(v, str) and v and len(v) <= 200 for v in values):
            raise ValueError("regula_session_metadata_invalid")
        query = urllib.parse.urlencode({"workflowId": self.config.workflow_id})
        result = self._request(
            "POST",
            "/api/v1/deeplink?" + query,
            {
                "metadata": {
                    "izakhono_entity_ref": entity_ref,
                    "izakhono_subject_ref_hash": subject_ref_hash,
                    "purpose": purpose,
                    "jurisdiction": jurisdiction,
                    "notice_version": notice_version,
                    **({"izakhono_idempotency_key_hash": idempotency_key_hash} if idempotency_key_hash else {}),
                },
                "locale": self.config.locale,
                "ttl": self.config.ttl_seconds,
            },
        )
        handoff_url = result.get("url")
        if not isinstance(handoff_url, str):
            raise RegulaAPIError("regula_handoff_url_missing")
        parsed = urllib.parse.urlsplit(handoff_url)
        expected = urllib.parse.urlsplit(self.config.base_url)
        if parsed.scheme != "https" or parsed.netloc != expected.netloc:
            raise RegulaAPIError("regula_handoff_url_origin_mismatch")
        if not isinstance(result.get("expiresAt"), str):
            raise RegulaAPIError("regula_handoff_expiry_missing")
        return result

    def get_session(self, session_id: str) -> dict[str, Any]:
        if not isinstance(session_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]{1,160}", session_id):
            raise ValueError("invalid_regula_session_id")
        return self._request("GET", "/api/sessions/" + urllib.parse.quote(session_id, safe=""))


def load_regula_idv_client() -> RegulaIDVHttpClient:
    """Construct from environment only; never accept secrets from request payloads."""
    return RegulaIDVHttpClient(RegulaIDVConfig.from_env())
