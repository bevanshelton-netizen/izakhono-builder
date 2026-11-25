"""Tests for real Ed25519 attestation signature and trust validation."""
import base64
from datetime import datetime, timedelta, timezone
import unittest

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from attestation_verifier import (
    AttestationVerificationError,
    Ed25519AttestationVerifier,
    TrustedAttestationKey,
    canonical_attestation_payload,
)


class Ed25519AttestationVerifierTests(unittest.TestCase):
    def setUp(self):
        self.private = Ed25519PrivateKey.generate()
        self.public = self.private.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw,
        )
        now = datetime.now(timezone.utc)
        self.trusted = TrustedAttestationKey(
            key_id="test-key-01", public_key=self.public,
            provider_id="test-provider", provider_account_ref="test-account-ref",
            valid_from=(now - timedelta(days=1)).isoformat(),
            valid_until=(now + timedelta(days=1)).isoformat(),
        )
        self.verifier = Ed25519AttestationVerifier({"test-key-01": self.trusted})
        self.evidence = {
            "resource_id": "resource-test-001", "provider_id": "test-provider",
            "provider_account_ref": "test-account-ref", "region": "test-region-1",
            "environment": "development", "logical_node_id": "NODE01",
            "logical_node_type": "software-runtime", "runtime_agent_identity": "agent-node01-test",
            "evidence_id": "evidence-test-001",
            "attested_at": now.isoformat(),
            "expires_at": (now + timedelta(minutes=5)).isoformat(),
            "capabilities": ["container-runtime", "network-egress"],
            "checks": [
                "agent_identity_verified", "runtime_binding_verified",
                "security_baseline_verified", "heartbeat_verified",
            ],
        }

    def signed(self, evidence=None):
        payload = dict(evidence or self.evidence)
        payload["signature"] = {
            "algorithm": "Ed25519", "key_id": "test-key-01",
            "value": base64.b64encode(
                self.private.sign(canonical_attestation_payload(payload))
            ).decode("ascii"),
        }
        return payload

    def test_valid_signature_is_accepted(self):
        self.assertTrue(self.verifier.verify(self.signed()))

    def test_modified_claim_after_signing_is_rejected(self):
        signed = self.signed()
        signed["logical_node_id"] = "NODE99"
        with self.assertRaisesRegex(AttestationVerificationError, "SIGNATURE_INVALID"):
            self.verifier.verify(signed)

    def test_unknown_key_is_rejected(self):
        signed = self.signed()
        signed["signature"]["key_id"] = "untrusted-key"
        with self.assertRaisesRegex(AttestationVerificationError, "KEY_UNTRUSTED"):
            self.verifier.verify(signed)

    def test_revoked_key_is_rejected(self):
        revoked = TrustedAttestationKey(**{**self.trusted.__dict__, "revoked": True})
        verifier = Ed25519AttestationVerifier({"test-key-01": revoked})
        with self.assertRaisesRegex(AttestationVerificationError, "KEY_REVOKED"):
            verifier.verify(self.signed())

    def test_provider_account_scope_is_enforced(self):
        signed = self.signed()
        signed["provider_account_ref"] = "different-account"
        # Re-sign to prove this is a trust-scope failure, not merely bad signature.
        signed["signature"]["value"] = base64.b64encode(
            self.private.sign(canonical_attestation_payload(signed))
        ).decode("ascii")
        with self.assertRaisesRegex(AttestationVerificationError, "KEY_SCOPE_MISMATCH"):
            self.verifier.verify(signed)

    def test_wrong_signature_algorithm_is_rejected(self):
        signed = self.signed()
        signed["signature"]["algorithm"] = "RS256"
        with self.assertRaisesRegex(AttestationVerificationError, "ALGORITHM_UNSUPPORTED"):
            self.verifier.verify(signed)

    def test_missing_signature_is_rejected(self):
        with self.assertRaisesRegex(AttestationVerificationError, "SIGNATURE_MISSING"):
            self.verifier.verify(self.evidence)


if __name__ == "__main__":
    unittest.main(verbosity=2)
