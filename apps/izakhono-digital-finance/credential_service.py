#!/usr/bin/env python3
"""Signed pseudonymous completion records for IZAKHONO Digital Finance Academy."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
import uuid
from typing import Any


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64d(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def issue_completion_record(
    signing_key: str,
    *,
    learner_ref: str,
    institution_ref: str,
    programme_id: str,
) -> str:
    if not signing_key:
        raise ValueError("credential_signing_key_required")
    payload = {
        "v": 1,
        "credential_ref": "IZDF-" + uuid.uuid4().hex[:16].upper(),
        "learner_ref": learner_ref,
        "institution_ref": institution_ref,
        "programme_id": programme_id,
        "credential_type": "IZAKHONO professional completion record",
        "issued_at": int(time.time()),
        "degree": False,
        "accreditation_claim": False,
    }
    body = _b64e(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    sig = _b64e(hmac.new(signing_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return body + "." + sig


def verify_completion_record(signing_key: str, record: str) -> dict[str, Any]:
    if not signing_key:
        raise ValueError("credential_signing_key_required")
    try:
        body, supplied_sig = record.split(".", 1)
    except ValueError as exc:
        raise ValueError("invalid_completion_record") from exc

    expected_sig = _b64e(
        hmac.new(signing_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(supplied_sig, expected_sig):
        raise ValueError("invalid_completion_record")

    try:
        payload = json.loads(_b64d(body).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid_completion_record") from exc

    if payload.get("v") != 1 or payload.get("credential_type") != "IZAKHONO professional completion record":
        raise ValueError("invalid_completion_record")
    return payload
