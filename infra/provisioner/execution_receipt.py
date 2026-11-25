"""Canonical, secret-safe terminal execution receipts."""
from __future__ import annotations

import hashlib
import json
from typing import Any, Mapping

from job_store import AuditEvent, StoredJob, utc_now

TERMINAL_OUTCOMES = {
    "HANDOVER_READY": "SUCCEEDED",
    "BLOCKED": "FAILED",
}


SECRET_FIELDS = {"password", "token", "api_key", "access_token", "refresh_token", "private_key", "client_secret", "secret"}


def _reject_secrets(value: Any, path: str = "receipt") -> None:
    if isinstance(value, Mapping):
        for key, child in value.items():
            if str(key).lower() in SECRET_FIELDS:
                raise ValueError(f"secret field prohibited at {path}.{key}")
            _reject_secrets(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_secrets(child, f"{path}[{index}]")


def build_terminal_receipt(job: StoredJob, details: Mapping[str, Any] | None = None) -> tuple[dict[str, Any], AuditEvent]:
    """Build a stable receipt identity from the terminal state and verified evidence."""
    outcome = TERMINAL_OUTCOMES.get(job.state)
    if outcome is None:
        raise ValueError("job is not in a supported terminal state")
    evidence = {key: value for key, value in job.evidence.items() if key != "TERMINAL_RECEIPT"}
    receipt_details = dict(details or {})
    _reject_secrets(evidence, "evidence")
    _reject_secrets(receipt_details, "details")
    evidence_bytes = json.dumps(evidence, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    evidence_digest = hashlib.sha256(evidence_bytes).hexdigest()
    identity = hashlib.sha256(f"{job.job_id}:{job.state}:{evidence_digest}".encode("utf-8")).hexdigest()[:32]
    completed_at = utc_now()
    receipt = {
        "schema_version": 1,
        "receipt_id": f"rcpt_{identity}",
        "job_id": job.job_id,
        "tenant_id": job.tenant_id,
        "status": outcome,
        "terminal_state": job.state,
        "completed_at": completed_at,
        "attempts": job.attempts,
        "evidence_states": sorted(evidence),
        "evidence_sha256": evidence_digest,
        "details": receipt_details,
    }
    event = AuditEvent(
        event_id=f"evt_{receipt['receipt_id']}",
        job_id=job.job_id,
        event_type="TERMINAL_RECEIPT",
        state=job.state,
        observed_at=completed_at,
        data={"receipt": receipt},
    )
    return receipt, event
