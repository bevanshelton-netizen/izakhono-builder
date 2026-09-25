#!/usr/bin/env python3
"""Pseudonymous learner access tokens for IZAKHONO Digital Finance Academy."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time
from typing import Any


def _b64e(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("ascii").rstrip("=")


def _b64d(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def issue_token(
    signing_key: str,
    *,
    learner_ref: str,
    institution_ref: str,
    role: str,
    ttl_seconds: int = 8 * 60 * 60,
) -> str:
    if not signing_key:
        raise ValueError("learner_signing_key_required")
    if not learner_ref or not institution_ref:
        raise ValueError("learner_and_institution_refs_required")

    now = int(time.time())
    payload = {
        "v": 1,
        "sub": learner_ref,
        "institution_ref": institution_ref,
        "role": role or "general_employee",
        "iat": now,
        "exp": now + max(300, min(int(ttl_seconds), 7 * 24 * 60 * 60)),
    }
    body = _b64e(json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8"))
    signature = _b64e(hmac.new(signing_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest())
    return body + "." + signature


def verify_token(signing_key: str, token: str) -> dict[str, Any]:
    if not signing_key:
        raise ValueError("learner_signing_key_required")
    try:
        body, supplied_sig = token.split(".", 1)
    except ValueError as exc:
        raise ValueError("invalid_learner_token") from exc

    expected_sig = _b64e(
        hmac.new(signing_key.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    )
    if not hmac.compare_digest(supplied_sig, expected_sig):
        raise ValueError("invalid_learner_token")

    try:
        payload = json.loads(_b64d(body).decode("utf-8"))
    except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("invalid_learner_token") from exc

    if payload.get("v") != 1:
        raise ValueError("unsupported_learner_token")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("expired_learner_token")
    if not payload.get("sub") or not payload.get("institution_ref"):
        raise ValueError("invalid_learner_token")
    return payload
