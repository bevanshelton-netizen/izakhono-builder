"""Ed25519 verifier for provider/runtime execution-environment attestations.

Trusted public keys must be provisioned from an owner-controlled trust store.
This module contains no private keys and performs no network or provider calls.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
import base64
import binascii
import json
from typing import Any, Mapping

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey


class AttestationVerificationError(ValueError):
    """Attestation signature or trust metadata is invalid."""


@dataclass(frozen=True)
class TrustedAttestationKey:
    key_id: str
    public_key: bytes
    provider_id: str
    provider_account_ref: str
    valid_from: str
    valid_until: str
    revoked: bool = False


def canonical_attestation_payload(evidence: Mapping[str, Any]) -> bytes:
    """Canonical UTF-8 JSON bytes for all signed claims, excluding signature."""
    if not isinstance(evidence, Mapping) or "signature" not in evidence:
        raise AttestationVerificationError("ATTESTATION_SIGNATURE_MISSING")
    payload = {key: value for key, value in evidence.items() if key != "signature"}
    try:
        return json.dumps(
            payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise AttestationVerificationError("ATTESTATION_PAYLOAD_NOT_CANONICAL_JSON") from exc


class Ed25519AttestationVerifier:
    """Verify signed evidence against explicitly pinned, scoped public keys."""

    def __init__(self, trusted_keys: Mapping[str, TrustedAttestationKey]):
        self._keys = dict(trusted_keys)
        for key_id, trusted in self._keys.items():
            if key_id != trusted.key_id or len(trusted.public_key) != 32:
                raise AttestationVerificationError("TRUSTED_KEY_CONFIGURATION_INVALID")

    @staticmethod
    def _parse_time(value: str, field: str) -> datetime:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except (AttributeError, ValueError) as exc:
            raise AttestationVerificationError(f"TRUSTED_KEY_TIME_INVALID:{field}") from exc
        if parsed.tzinfo is None:
            raise AttestationVerificationError(f"TRUSTED_KEY_TIMEZONE_REQUIRED:{field}")
        return parsed.astimezone(timezone.utc)

    def verify(self, evidence: Mapping[str, Any]) -> bool:
        signature_block = evidence.get("signature") if isinstance(evidence, Mapping) else None
        if not isinstance(signature_block, Mapping):
            raise AttestationVerificationError("ATTESTATION_SIGNATURE_MISSING")
        if signature_block.get("algorithm") != "Ed25519":
            raise AttestationVerificationError("ATTESTATION_SIGNATURE_ALGORITHM_UNSUPPORTED")
        key_id = signature_block.get("key_id")
        trusted = self._keys.get(key_id) if isinstance(key_id, str) else None
        if trusted is None:
            raise AttestationVerificationError("ATTESTATION_SIGNING_KEY_UNTRUSTED")
        if trusted.revoked:
            raise AttestationVerificationError("ATTESTATION_SIGNING_KEY_REVOKED")
        if (
            evidence.get("provider_id") != trusted.provider_id
            or evidence.get("provider_account_ref") != trusted.provider_account_ref
        ):
            raise AttestationVerificationError("ATTESTATION_SIGNING_KEY_SCOPE_MISMATCH")

        now = datetime.now(timezone.utc)
        if not (
            self._parse_time(trusted.valid_from, "valid_from")
            <= now
            <= self._parse_time(trusted.valid_until, "valid_until")
        ):
            raise AttestationVerificationError("ATTESTATION_SIGNING_KEY_OUTSIDE_VALIDITY")

        encoded = signature_block.get("value")
        if not isinstance(encoded, str) or not encoded:
            raise AttestationVerificationError("ATTESTATION_SIGNATURE_ENCODING_INVALID")
        try:
            signature = base64.b64decode(encoded, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise AttestationVerificationError("ATTESTATION_SIGNATURE_ENCODING_INVALID") from exc
        if len(signature) != 64:
            raise AttestationVerificationError("ATTESTATION_SIGNATURE_LENGTH_INVALID")

        try:
            Ed25519PublicKey.from_public_bytes(trusted.public_key).verify(
                signature, canonical_attestation_payload(evidence)
            )
        except InvalidSignature as exc:
            raise AttestationVerificationError("ATTESTATION_SIGNATURE_INVALID") from exc
        except ValueError as exc:
            raise AttestationVerificationError("ATTESTATION_PUBLIC_KEY_INVALID") from exc
        return True

    def __call__(self, evidence: Mapping[str, Any]) -> bool:
        return self.verify(evidence)
