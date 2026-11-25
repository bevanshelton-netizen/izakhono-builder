"""Synthetic IZAKHONO AI Workforce decision-contract conformance tests.

This is a test-only reference model. It does not authenticate production callers,
verify real cryptographic signatures, contact FORTRESS, access secrets, or execute
workloads. The injected signature callback represents a trusted test harness.
Never import this module into a production authorization path.
"""
from __future__ import annotations

import unittest
from dataclasses import dataclass
from typing import Callable, Mapping, Any


@dataclass(frozen=True)
class ExpectedRequest:
    issuer: str = "https://fortress.test"
    audience: str = "node01-tool-fabric.test"
    tenant_id: str = "tenant-test-01"
    actor_id: str = "service:node01-test"
    agent_id: str = "agent-test-01"
    action: str = "tool.invoke"
    resource: str = "tool:records.read"
    fingerprint: str = "sha256:test-request-fingerprint"
    policy_version: str = "policy-test-v1"


class ContractError(ValueError):
    """Stable test-model rejection; not a production API error vocabulary."""


def verify_synthetic_decision(
    decision: Mapping[str, Any],
    expected: ExpectedRequest,
    *,
    now: int,
    revoked_ids: set[str] | None = None,
    signature_verifier: Callable[[Mapping[str, Any]], bool] | None = None,
) -> None:
    """Validate a synthetic decision against one exact request context."""
    required = (
        "issuer", "audience", "tenant_id", "actor_id", "agent_id",
        "action", "resource", "request_fingerprint", "policy_version",
        "decision_id", "artifact_id", "not_before", "expires_at",
        "signature",
    )
    for field in required:
        if field not in decision or decision[field] in (None, ""):
            raise ContractError(f"MISSING_{field.upper()}")

    expected_fields = {
        "issuer": expected.issuer,
        "audience": expected.audience,
        "tenant_id": expected.tenant_id,
        "actor_id": expected.actor_id,
        "agent_id": expected.agent_id,
        "action": expected.action,
        "resource": expected.resource,
        "request_fingerprint": expected.fingerprint,
        "policy_version": expected.policy_version,
    }
    for field, value in expected_fields.items():
        if decision[field] != value:
            raise ContractError(f"MISMATCH_{field.upper()}")

    if not isinstance(decision["not_before"], int) or not isinstance(decision["expires_at"], int):
        raise ContractError("INVALID_TIME_CLAIMS")
    if decision["expires_at"] <= decision["not_before"]:
        raise ContractError("INVALID_VALIDITY_WINDOW")
    if now < decision["not_before"]:
        raise ContractError("DECISION_NOT_YET_VALID")
    if now >= decision["expires_at"]:
        raise ContractError("DECISION_EXPIRED")
    if decision.get("decision") != "ALLOW":
        raise ContractError("DECISION_NOT_ALLOW")
    if decision["decision_id"] in (revoked_ids or set()):
        raise ContractError("DECISION_REVOKED")
    if signature_verifier is None or not signature_verifier(decision):
        raise ContractError("SIGNATURE_NOT_VERIFIED")


def verify_synthetic_approval(
    approval: Mapping[str, Any],
    *,
    expected: ExpectedRequest,
    now: int,
    eligible_approvers: set[str],
) -> None:
    """Check a separately supplied human approval bound to the same request."""
    required = ("approval_id", "state", "human_principal_id", "tenant_id",
                "request_fingerprint", "expires_at")
    for field in required:
        if field not in approval or approval[field] in (None, ""):
            raise ContractError(f"MISSING_APPROVAL_{field.upper()}")
    if approval["state"] != "APPROVED":
        raise ContractError("APPROVAL_NOT_APPROVED")
    if approval["human_principal_id"] == expected.actor_id:
        raise ContractError("SERVICE_CANNOT_APPROVE")
    if approval["human_principal_id"] not in eligible_approvers:
        raise ContractError("APPROVER_NOT_ELIGIBLE")
    if approval["tenant_id"] != expected.tenant_id:
        raise ContractError("APPROVAL_TENANT_MISMATCH")
    if approval["request_fingerprint"] != expected.fingerprint:
        raise ContractError("APPROVAL_FINGERPRINT_MISMATCH")
    if not isinstance(approval["expires_at"], int) or now >= approval["expires_at"]:
        raise ContractError("APPROVAL_EXPIRED")


class DecisionContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.expected = ExpectedRequest()
        self.decision = {
            "issuer": self.expected.issuer,
            "audience": self.expected.audience,
            "tenant_id": self.expected.tenant_id,
            "actor_id": self.expected.actor_id,
            "agent_id": self.expected.agent_id,
            "action": self.expected.action,
            "resource": self.expected.resource,
            "request_fingerprint": self.expected.fingerprint,
            "policy_version": self.expected.policy_version,
            "decision_id": "decision-test-01",
            "artifact_id": "artifact-test-01",
            "not_before": 1_800_000_000,
            "expires_at": 1_800_000_300,
            "decision": "ALLOW",
            "signature": "synthetic-signature",
        }
        self.verify_signature = lambda artifact: artifact.get("signature") == "synthetic-signature"

    def verify(self, decision=None, **kwargs) -> None:
        verify_synthetic_decision(
            decision or self.decision, self.expected, now=1_800_000_100,
            signature_verifier=self.verify_signature, **kwargs
        )

    def test_accepts_exact_scoped_unexpired_allow(self):
        self.verify()

    def test_rejects_missing_artifact_field(self):
        artifact = dict(self.decision)
        del artifact["audience"]
        with self.assertRaisesRegex(ContractError, "MISSING_AUDIENCE"):
            self.verify(artifact)

    def test_rejects_wrong_issuer(self):
        artifact = dict(self.decision, issuer="https://untrusted.test")
        with self.assertRaisesRegex(ContractError, "MISMATCH_ISSUER"):
            self.verify(artifact)

    def test_rejects_wrong_audience(self):
        artifact = dict(self.decision, audience="other-service")
        with self.assertRaisesRegex(ContractError, "MISMATCH_AUDIENCE"):
            self.verify(artifact)

    def test_rejects_cross_tenant_decision(self):
        artifact = dict(self.decision, tenant_id="tenant-other")
        with self.assertRaisesRegex(ContractError, "MISMATCH_TENANT_ID"):
            self.verify(artifact)

    def test_rejects_changed_request_fingerprint(self):
        artifact = dict(self.decision, request_fingerprint="sha256:changed")
        with self.assertRaisesRegex(ContractError, "MISMATCH_REQUEST_FINGERPRINT"):
            self.verify(artifact)


    def test_rejects_wrong_actor(self):
        artifact = dict(self.decision, actor_id="service:other")
        with self.assertRaisesRegex(ContractError, "MISMATCH_ACTOR_ID"):
            self.verify(artifact)

    def test_rejects_wrong_agent(self):
        artifact = dict(self.decision, agent_id="agent-other")
        with self.assertRaisesRegex(ContractError, "MISMATCH_AGENT_ID"):
            self.verify(artifact)

    def test_rejects_wrong_action(self):
        artifact = dict(self.decision, action="tool.delete")
        with self.assertRaisesRegex(ContractError, "MISMATCH_ACTION"):
            self.verify(artifact)

    def test_rejects_wrong_resource(self):
        artifact = dict(self.decision, resource="tool:records.delete")
        with self.assertRaisesRegex(ContractError, "MISMATCH_RESOURCE"):
            self.verify(artifact)

    def test_rejects_stale_policy_version(self):
        artifact = dict(self.decision, policy_version="policy-old")
        with self.assertRaisesRegex(ContractError, "MISMATCH_POLICY_VERSION"):
            self.verify(artifact)

    def test_rejects_invalid_validity_window(self):
        artifact = dict(self.decision, not_before=1_800_000_050, expires_at=1_800_000_040)
        with self.assertRaisesRegex(ContractError, "INVALID_VALIDITY_WINDOW"):
            self.verify(artifact)

    def test_rejects_non_integer_time_claims(self):
        artifact = dict(self.decision, expires_at="1800000300")
        with self.assertRaisesRegex(ContractError, "INVALID_TIME_CLAIMS"):
            self.verify(artifact)

    def test_rejects_expired_decision(self):
        artifact = dict(self.decision, expires_at=1_800_000_100)
        with self.assertRaisesRegex(ContractError, "DECISION_EXPIRED"):
            self.verify(artifact)

    def test_rejects_not_yet_valid_decision(self):
        artifact = dict(self.decision, not_before=1_800_000_101)
        with self.assertRaisesRegex(ContractError, "DECISION_NOT_YET_VALID"):
            self.verify(artifact)

    def test_rejects_revoked_decision(self):
        with self.assertRaisesRegex(ContractError, "DECISION_REVOKED"):
            self.verify(revoked_ids={"decision-test-01"})

    def test_rejects_unverified_signature(self):
        with self.assertRaisesRegex(ContractError, "SIGNATURE_NOT_VERIFIED"):
            verify_synthetic_decision(
                self.decision, self.expected, now=1_800_000_100,
                signature_verifier=lambda artifact: False,
            )

    def test_rejects_non_allow_decision(self):
        artifact = dict(self.decision, decision="DENY")
        with self.assertRaisesRegex(ContractError, "DECISION_NOT_ALLOW"):
            self.verify(artifact)


class HumanApprovalContractTests(unittest.TestCase):
    def setUp(self) -> None:
        self.expected = ExpectedRequest()
        self.approval = {
            "approval_id": "approval-test-01",
            "state": "APPROVED",
            "human_principal_id": "human:approver-01",
            "tenant_id": self.expected.tenant_id,
            "request_fingerprint": self.expected.fingerprint,
            "expires_at": 1_800_000_300,
        }

    def verify(self, approval=None) -> None:
        verify_synthetic_approval(
            approval or self.approval, expected=self.expected,
            now=1_800_000_100, eligible_approvers={"human:approver-01"},
        )

    def test_accepts_eligible_human_approval_for_exact_request(self):
        self.verify()

    def test_rejects_ineligible_approver(self):
        approval = dict(self.approval, human_principal_id="human:unknown")
        with self.assertRaisesRegex(ContractError, "APPROVER_NOT_ELIGIBLE"):
            self.verify(approval)

    def test_rejects_service_as_approver(self):
        approval = dict(self.approval, human_principal_id=self.expected.actor_id)
        with self.assertRaisesRegex(ContractError, "SERVICE_CANNOT_APPROVE"):
            self.verify(approval)

    def test_rejects_approval_for_different_fingerprint(self):
        approval = dict(self.approval, request_fingerprint="sha256:other")
        with self.assertRaisesRegex(ContractError, "APPROVAL_FINGERPRINT_MISMATCH"):
            self.verify(approval)


    def test_rejects_cross_tenant_approval(self):
        approval = dict(self.approval, tenant_id="tenant-other")
        with self.assertRaisesRegex(ContractError, "APPROVAL_TENANT_MISMATCH"):
            self.verify(approval)

    def test_rejects_missing_approval_fingerprint(self):
        approval = dict(self.approval)
        del approval["request_fingerprint"]
        with self.assertRaisesRegex(ContractError, "MISSING_APPROVAL_REQUEST_FINGERPRINT"):
            self.verify(approval)

    def test_rejects_expired_approval(self):
        approval = dict(self.approval, expires_at=1_800_000_100)
        with self.assertRaisesRegex(ContractError, "APPROVAL_EXPIRED"):
            self.verify(approval)

    def test_rejects_pending_approval(self):
        approval = dict(self.approval, state="PENDING")
        with self.assertRaisesRegex(ContractError, "APPROVAL_NOT_APPROVED"):
            self.verify(approval)


if __name__ == "__main__":
    unittest.main(verbosity=2)
