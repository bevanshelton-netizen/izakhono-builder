"""Synthetic runtime-registration and HOST-receipt contract tests.

Test-only reference model. No live registry, cryptographic keys, runner, network,
secrets, database or workload execution is used.
"""
from __future__ import annotations

import unittest
from typing import Any, Callable, Mapping


class ContractError(ValueError):
    pass


def verify_runtime_binding(
    binding: Mapping[str, Any], *, expected_tenant: str, expected_agent: str,
    now: int, max_age_seconds: int,
    registration_verifier: Callable[[Mapping[str, Any]], bool] | None,
    health_verifier: Callable[[Mapping[str, Any]], bool] | None,
    revocation_verifier: Callable[[str], bool] | None,
) -> None:
    if not isinstance(binding, Mapping):
        raise ContractError("RUNTIME_INVALID_BINDING_MAPPING")
    required = (
        "binding_id", "tenant_id", "agent_id", "runtime_id", "environment_id",
        "adapter_id", "registered_at", "expires_at", "status", "credential_ref",
    )
    for field in required:
        if field not in binding or binding[field] in (None, ""):
            raise ContractError(f"MISSING_{field.upper()}")
    if binding["tenant_id"] != expected_tenant:
        raise ContractError("RUNTIME_TENANT_MISMATCH")
    if binding["agent_id"] != expected_agent:
        raise ContractError("RUNTIME_AGENT_MISMATCH")
    if binding["status"] != "ACTIVE":
        raise ContractError("RUNTIME_NOT_ACTIVE")
    if type(binding["registered_at"]) is not int or type(binding["expires_at"]) is not int:
        raise ContractError("RUNTIME_INVALID_TIME_CLAIMS")
    if binding["expires_at"] <= binding["registered_at"]:
        raise ContractError("RUNTIME_INVALID_VALIDITY_WINDOW")
    if type(now) is not int or type(max_age_seconds) is not int or max_age_seconds < 0:
        raise ContractError("RUNTIME_INVALID_VERIFIER_TIME_CONFIG")
    if binding["expires_at"] <= now:
        raise ContractError("RUNTIME_BINDING_EXPIRED")
    if binding["registered_at"] > now:
        raise ContractError("RUNTIME_REGISTERED_IN_FUTURE")
    if now - binding["registered_at"] > max_age_seconds:
        raise ContractError("RUNTIME_REGISTRATION_STALE")
    if registration_verifier is None or not registration_verifier(binding):
        raise ContractError("RUNTIME_REGISTRATION_NOT_VERIFIED")
    if health_verifier is None or not health_verifier(binding):
        raise ContractError("RUNTIME_HEALTH_NOT_VERIFIED")
    if revocation_verifier is None or not revocation_verifier(binding["binding_id"]):
        raise ContractError("RUNTIME_REVOCATION_UNKNOWN_OR_REVOKED")


def verify_execution_receipt(
    receipt: Mapping[str, Any], *, expected: Mapping[str, str], now: int,
    verifier: Callable[[Mapping[str, Any]], bool] | None,
) -> None:
    if not isinstance(receipt, Mapping):
        raise ContractError("RECEIPT_INVALID_MAPPING")
    if not isinstance(expected, Mapping):
        raise ContractError("RECEIPT_INVALID_EXPECTED_CONTEXT")
    if type(now) is not int:
        raise ContractError("RECEIPT_INVALID_VERIFIER_TIME")
    required = (
        "receipt_id", "task_id", "attempt_id", "tenant_id", "agent_id",
        "runtime_binding_id", "environment_id", "adapter_id", "decision_id",
        "request_fingerprint", "tool_id", "started_at", "completed_at",
        "outcome", "output_digest", "signature",
    )
    for field in required:
        if field not in receipt or receipt[field] in (None, ""):
            raise ContractError(f"RECEIPT_MISSING_{field.upper()}")
    for field, value in expected.items():
        if receipt.get(field) != value:
            raise ContractError(f"RECEIPT_MISMATCH_{field.upper()}")
    if type(receipt["started_at"]) is not int or type(receipt["completed_at"]) is not int:
        raise ContractError("RECEIPT_INVALID_TIME_CLAIMS")
    if receipt["completed_at"] < receipt["started_at"] or receipt["completed_at"] > now:
        raise ContractError("RECEIPT_INVALID_TIME_ORDER")
    if receipt["outcome"] not in {"SUCCEEDED", "FAILED", "CANCELLED", "PARTIAL"}:
        raise ContractError("RECEIPT_INVALID_OUTCOME")
    if verifier is None or not verifier(receipt):
        raise ContractError("RECEIPT_SIGNATURE_NOT_VERIFIED")


class RuntimeBindingTests(unittest.TestCase):
    def setUp(self):
        self.binding = {
            "binding_id": "binding-01", "tenant_id": "tenant-01",
            "agent_id": "agent-01", "runtime_id": "runtime-01",
            "environment_id": "host-env-01", "adapter_id": "host-adapter-01",
            "registered_at": 1_800_000_000, "expires_at": 1_800_000_600,
            "status": "ACTIVE", "credential_ref": "opaque://credential/01",
        }
        self.registration_ok = lambda b: b["binding_id"] == "binding-01"
        self.health_ok = lambda b: True
        self.not_revoked = lambda binding_id: True

    def verify(self, binding=None, **kwargs):
        options = {
            "expected_tenant": "tenant-01", "expected_agent": "agent-01",
            "now": 1_800_000_100, "max_age_seconds": 300,
            "registration_verifier": self.registration_ok,
            "health_verifier": self.health_ok,
            "revocation_verifier": self.not_revoked,
        }
        options.update(kwargs)
        verify_runtime_binding(
            self.binding if binding is None else binding, **options,
        )

    def test_accepts_fresh_registered_healthy_binding(self):
        self.verify()

    def test_rejects_non_mapping_binding(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_INVALID_BINDING_MAPPING"):
            verify_runtime_binding(
                None, expected_tenant="tenant-01", expected_agent="agent-01",
                now=1_800_000_100, max_age_seconds=300,
                registration_verifier=self.registration_ok,
                health_verifier=self.health_ok, revocation_verifier=self.not_revoked,
            )

    def test_rejects_boolean_registration_time(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_INVALID_TIME_CLAIMS"):
            self.verify(dict(self.binding, registered_at=True))

    def test_rejects_wrong_tenant(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_TENANT_MISMATCH"):
            self.verify(dict(self.binding, tenant_id="tenant-02"))

    def test_rejects_wrong_agent(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_AGENT_MISMATCH"):
            self.verify(dict(self.binding, agent_id="agent-02"))

    def test_rejects_pending_binding(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_NOT_ACTIVE"):
            self.verify(dict(self.binding, status="PENDING"))

    def test_rejects_expired_binding(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_BINDING_EXPIRED"):
            self.verify(dict(self.binding, expires_at=1_800_000_100))

    def test_rejects_expiry_before_registration(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_INVALID_VALIDITY_WINDOW"):
            self.verify(dict(self.binding, expires_at=1_799_999_999))

    def test_rejects_negative_health_age_configuration(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_INVALID_VERIFIER_TIME_CONFIG"):
            self.verify(max_age_seconds=-1)

    def test_rejects_stale_registration(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_REGISTRATION_STALE"):
            self.verify(dict(self.binding, registered_at=1_799_999_700))

    def test_rejects_unverified_registration(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_REGISTRATION_NOT_VERIFIED"):
            self.verify(registration_verifier=lambda b: False)

    def test_rejects_unverified_health(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_HEALTH_NOT_VERIFIED"):
            self.verify(health_verifier=lambda b: False)

    def test_fails_closed_when_revocation_unknown(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_REVOCATION_UNKNOWN_OR_REVOKED"):
            self.verify(revocation_verifier=None)

    def test_rejects_revoked_binding(self):
        with self.assertRaisesRegex(ContractError, "RUNTIME_REVOCATION_UNKNOWN_OR_REVOKED"):
            self.verify(revocation_verifier=lambda binding_id: False)


class ExecutionReceiptTests(unittest.TestCase):
    def setUp(self):
        self.receipt = {
            "receipt_id": "receipt-01", "task_id": "task-01",
            "attempt_id": "attempt-01", "tenant_id": "tenant-01",
            "agent_id": "agent-01", "runtime_binding_id": "binding-01",
            "environment_id": "host-env-01", "adapter_id": "host-adapter-01",
            "decision_id": "decision-01", "request_fingerprint": "sha256:req-01",
            "tool_id": "tool:records.read", "started_at": 1_800_000_010,
            "completed_at": 1_800_000_020, "outcome": "SUCCEEDED",
            "output_digest": "sha256:output-01", "signature": "synthetic-sig",
        }
        self.expected = {
            "task_id": "task-01", "attempt_id": "attempt-01",
            "tenant_id": "tenant-01", "agent_id": "agent-01",
            "runtime_binding_id": "binding-01", "environment_id": "host-env-01",
            "adapter_id": "host-adapter-01", "decision_id": "decision-01",
            "request_fingerprint": "sha256:req-01", "tool_id": "tool:records.read",
        }
        self.signature_ok = lambda r: r["signature"] == "synthetic-sig"

    def verify(self, receipt=None, **kwargs):
        options = {
            "expected": self.expected, "now": 1_800_000_100,
            "verifier": self.signature_ok,
        }
        options.update(kwargs)
        verify_execution_receipt(
            self.receipt if receipt is None else receipt, **options,
        )

    def test_accepts_correlated_signed_receipt(self):
        self.verify()

    def test_rejects_non_mapping_receipt(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_INVALID_MAPPING"):
            verify_execution_receipt(
                None, expected=self.expected, now=1_800_000_100,
                verifier=self.signature_ok,
            )

    def test_rejects_non_mapping_expected_context(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_INVALID_EXPECTED_CONTEXT"):
            verify_execution_receipt(
                self.receipt, expected=None, now=1_800_000_100,
                verifier=self.signature_ok,
            )

    def test_rejects_boolean_receipt_timestamps(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_INVALID_TIME_CLAIMS"):
            self.verify(dict(self.receipt, started_at=True))

    def test_rejects_empty_receipt(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_MISSING_RECEIPT_ID"):
            self.verify({})

    def test_rejects_cross_tenant_receipt(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_MISMATCH_TENANT_ID"):
            self.verify(dict(self.receipt, tenant_id="tenant-02"))

    def test_rejects_wrong_runtime_binding(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_MISMATCH_RUNTIME_BINDING_ID"):
            self.verify(dict(self.receipt, runtime_binding_id="binding-elsewhere"))

    def test_rejects_wrong_authorization_decision(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_MISMATCH_DECISION_ID"):
            self.verify(dict(self.receipt, decision_id="decision-other"))

    def test_rejects_wrong_request_fingerprint(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_MISMATCH_REQUEST_FINGERPRINT"):
            self.verify(dict(self.receipt, request_fingerprint="sha256:other"))

    def test_rejects_future_or_reversed_timestamps(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_INVALID_TIME_ORDER"):
            self.verify(dict(self.receipt, completed_at=1_800_000_101))
        with self.assertRaisesRegex(ContractError, "RECEIPT_INVALID_TIME_ORDER"):
            self.verify(dict(self.receipt, completed_at=1_800_000_009))

    def test_rejects_unknown_outcome(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_INVALID_OUTCOME"):
            self.verify(dict(self.receipt, outcome="MAYBE"))

    def test_rejects_unverified_signature(self):
        with self.assertRaisesRegex(ContractError, "RECEIPT_SIGNATURE_NOT_VERIFIED"):
            self.verify(verifier=lambda r: False)


if __name__ == "__main__":
    unittest.main(verbosity=2)
