"""Conservative adapter from the Regula HTTP client to IZAKHONO ID.

The hosted hand-off URL is returned once as client_token. Regula workflow status
and check properties are intentionally not mapped until the tenant workflow's
signed schema and semantics have been verified. Consequently retrieval yields
indeterminate checks and can never auto-verify a person.
"""
from __future__ import annotations

import urllib.parse

from identity_verification import VerificationOutcome, VerificationStart
from regula_idv_http import RegulaIDVHttpClient


class RegulaIDVProviderTransport:
    def __init__(self, client: RegulaIDVHttpClient):
        self.client = client

    def health(self) -> bool:
        # Configuration was validated at client construction. Do not make an
        # undocumented health request or expose credentials to a probe endpoint.
        return True

    def create_verification(
        self, *, entity_ref: str, subject_ref_hash: str,
        idempotency_key_hash: str, jurisdiction: str, purpose: str,
        notice_version: str,
    ) -> VerificationStart:
        result = self.client.start_session(
            entity_ref=entity_ref,
            subject_ref_hash=subject_ref_hash,
            idempotency_key_hash=idempotency_key_hash,
            purpose=purpose,
            jurisdiction=jurisdiction,
            notice_version=notice_version,
        )
        handoff_url = result["url"]
        query = urllib.parse.parse_qs(urllib.parse.urlsplit(handoff_url).query)
        session_ids = query.get("sessionId") or query.get("session_id") or []
        if not session_ids or not session_ids[0]:
            raise RuntimeError("regula_session_id_missing_from_handoff")
        return VerificationStart(
            provider_session_ref=session_ids[0],
            client_token=handoff_url,
            expires_at=result.get("expiresAt"),
        )

    def get_verification(self, provider_session_ref: str) -> VerificationOutcome:
        # Fetching is wired, but mapping is intentionally blocked pending the
        # actual tenant workflow's documented status/check schema.
        self.client.get_session(provider_session_ref)
        return VerificationOutcome(
            "indeterminate", "indeterminate", "indeterminate", "indeterminate"
        )

    def cancel_verification(self, provider_session_ref: str) -> None:
        # No cancellation route is enabled until Regula confirms the licensed
        # tenant's cancellation contract. Do not pretend cancellation succeeded.
        raise RuntimeError("regula_session_cancellation_not_configured")
