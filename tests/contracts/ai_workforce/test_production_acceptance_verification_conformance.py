"""Synthetic cross-record production acceptance verification contract tests.

Injected verifiers and in-memory fixtures are not production trust anchors,
cryptographic verification, durable stores, or proof of deployed integration.
"""
from __future__ import annotations

import hashlib
import json
import unittest
from typing import Any, Callable, Mapping


class ContractError(ValueError):
    pass


def canonical(value: Mapping[str, Any]) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=True)


def digest(value: str) -> str:
    return "sha256:" + hashlib.sha256(value.encode("utf-8")).hexdigest()


def sample_bundle() -> dict[str, Any]:
    request = {
        "tenant_id": "tenant-a", "organization_id": "org-a",
        "operation_id": "op-1", "actor_id": "principal-1",
        "agent_id": "agent-1", "agent_version_id": "agent-version-1",
        "task_id": "task-1", "attempt_id": "attempt-1",
        "action": "agent.execute", "resource": "report-1", "tool_id": "tool-1",
        "purpose": "approved-analysis", "classification": "internal",
        "runtime_binding_id": "binding-1", "environment_id": "host-env-1",
    }
    fingerprint = digest(canonical(request))
    return {
        "request": request,
        "operation": {
            "operation_id": "op-1", "tenant_id": "tenant-a",
            "request_fingerprint": fingerprint, "idempotency_key": "idem-1",
            "state": "EFFECT_VERIFIED",
        },
        "decision": {
            "decision_id": "decision-1", "issuer": "FORTRESS",
            "audience": "host-adapter", "tenant_id": "tenant-a",
            "organization_id": "org-a", "actor_id": "principal-1",
            "agent_id": "agent-1", "agent_version_id": "agent-version-1",
            "action": "agent.execute", "resource": "report-1", "tool_id": "tool-1",
            "purpose": "approved-analysis", "classification": "internal",
            "runtime_binding_id": "binding-1", "environment_id": "host-env-1",
            "request_fingerprint": fingerprint, "policy_version": "policy-v1",
            "not_before": 100, "expires_at": 200, "revoked": False,
            "signature": "decision-signature",
        },
        "approval": {
            "required": True, "approval_id": "approval-1",
            "approver_id": "human-approver-1", "actor_id": "principal-1",
            "tenant_id": "tenant-a", "request_fingerprint": fingerprint,
            "expires_at": 190, "revoked": False, "signature": "approval-signature",
        },
        "runtime": {
            "runtime_binding_id": "binding-1", "tenant_id": "tenant-a",
            "workload_id": "workload-1", "adapter_id": "host-adapter",
            "environment_id": "host-env-1", "state": "ACTIVE",
            "health_at": 150, "health_ttl": 30, "revoked": False,
        },
        "receipt": {
            "receipt_id": "receipt-1", "issuer": "host-adapter",
            "audience": "host-adapter", "tenant_id": "tenant-a",
            "operation_id": "op-1", "request_fingerprint": fingerprint,
            "decision_id": "decision-1", "approval_id": "approval-1",
            "runtime_binding_id": "binding-1", "environment_id": "host-env-1",
            "agent_id": "agent-1", "agent_version_id": "agent-version-1",
            "task_id": "task-1", "attempt_id": "attempt-1",
            "action": "agent.execute", "tool_id": "tool-1",
            "outcome": "SUCCEEDED", "output_digest": "sha256:output",
            "signature": "receipt-signature",
        },
        "evidence": {
            "evidence_id": "evidence-1", "tenant_id": "tenant-a",
            "operation_id": "op-1", "digest": "sha256:evidence",
            "object_present": True, "classification": "internal",
            "retention_valid": True,
        },
        "event": {
            "event_id": "event-1", "tenant_id": "tenant-a",
            "operation_id": "op-1", "request_fingerprint": fingerprint,
            "decision_id": "decision-1", "approval_id": "approval-1",
            "evidence_id": "evidence-1", "idempotency_key": "idem-1",
            "outbox_committed": True,
        },
        "checkpoint": {
            "checkpoint_id": "checkpoint-1", "event_id": "event-1",
            "event_digest": "sha256:event", "signature": "checkpoint-signature",
            "retained": True,
        },
        "now": 150,
    }


class IndependentAcceptanceVerifier:
    def __init__(
        self,
        *,
        decision_verifier: Callable[[Mapping[str, Any]], bool],
        approval_verifier: Callable[[Mapping[str, Any]], bool],
        receipt_verifier: Callable[[Mapping[str, Any]], bool],
        checkpoint_verifier: Callable[[Mapping[str, Any]], bool],
        evidence_digest_verifier: Callable[[Mapping[str, Any]], bool],
    ):
        self.verifiers = (
            decision_verifier, approval_verifier, receipt_verifier,
            checkpoint_verifier, evidence_digest_verifier,
        )

    def verify(self, bundle: Mapping[str, Any]) -> str:
        try:
            request = bundle["request"]
            operation = bundle["operation"]
            decision = bundle["decision"]
            approval = bundle["approval"]
            runtime = bundle["runtime"]
            receipt = bundle["receipt"]
            evidence = bundle["evidence"]
            event = bundle["event"]
            checkpoint = bundle["checkpoint"]
            now = bundle["now"]
        except (KeyError, TypeError):
            raise ContractError("BUNDLE_INCOMPLETE")

        if not isinstance(now, int) or isinstance(now, bool):
            raise ContractError("TRUSTED_TIME_INVALID")
        fingerprint = digest(canonical(request))
        if operation.get("request_fingerprint") != fingerprint:
            raise ContractError("REQUEST_FINGERPRINT_MISMATCH")
        if operation.get("operation_id") != request.get("operation_id") or operation.get("tenant_id") != request.get("tenant_id"):
            raise ContractError("OPERATION_SCOPE_MISMATCH")
        if operation.get("state") != "EFFECT_VERIFIED":
            raise ContractError("OPERATION_NOT_EFFECT_VERIFIED")

        decision_fields = {
            "tenant_id": "tenant_id", "organization_id": "organization_id",
            "actor_id": "actor_id", "agent_id": "agent_id",
            "agent_version_id": "agent_version_id", "action": "action",
            "resource": "resource", "tool_id": "tool_id", "purpose": "purpose",
            "classification": "classification",
            "runtime_binding_id": "runtime_binding_id", "environment_id": "environment_id",
        }
        for source, target in decision_fields.items():
            if decision.get(source) != request.get(target):
                raise ContractError("DECISION_REQUEST_SCOPE_MISMATCH")
        if decision.get("request_fingerprint") != fingerprint or decision.get("issuer") != "FORTRESS":
            raise ContractError("DECISION_BINDING_INVALID")
        if not (decision.get("not_before", now + 1) <= now < decision.get("expires_at", now)):
            raise ContractError("DECISION_TIME_INVALID")
        if decision.get("revoked") is not False or self.verifiers[0](decision) is not True:
            raise ContractError("DECISION_UNVERIFIED_OR_REVOKED")

        if approval.get("required") is True:
            if approval.get("actor_id") != request.get("actor_id") or approval.get("tenant_id") != request.get("tenant_id") or approval.get("request_fingerprint") != fingerprint:
                raise ContractError("APPROVAL_SCOPE_MISMATCH")
            if approval.get("approver_id") in (None, "", request.get("actor_id")):
                raise ContractError("APPROVAL_SEPARATION_INVALID")
            if approval.get("revoked") is not False or now >= approval.get("expires_at", now):
                raise ContractError("APPROVAL_EXPIRED_OR_REVOKED")
            if self.verifiers[1](approval) is not True:
                raise ContractError("APPROVAL_UNVERIFIED")
        elif approval.get("required") is not False:
            raise ContractError("APPROVAL_REQUIREMENT_UNKNOWN")

        if (runtime.get("runtime_binding_id") != request.get("runtime_binding_id")
                or runtime.get("tenant_id") != request.get("tenant_id")
                or runtime.get("environment_id") != request.get("environment_id")
                or runtime.get("adapter_id") != decision.get("audience")
                or runtime.get("state") != "ACTIVE" or runtime.get("revoked") is not False):
            raise ContractError("RUNTIME_BINDING_INVALID")
        if not isinstance(runtime.get("health_at"), int) or now - runtime["health_at"] > runtime.get("health_ttl", 0):
            raise ContractError("RUNTIME_HEALTH_STALE")

        receipt_fields = {
            "tenant_id": "tenant_id", "operation_id": "operation_id",
            "request_fingerprint": None, "decision_id": None, "runtime_binding_id": "runtime_binding_id",
            "environment_id": "environment_id", "agent_id": "agent_id",
            "agent_version_id": "agent_version_id", "task_id": "task_id",
            "attempt_id": "attempt_id", "action": "action", "tool_id": "tool_id",
        }
        for source, target in receipt_fields.items():
            expected = fingerprint if source == "request_fingerprint" else decision.get("decision_id") if source == "decision_id" else request.get(target)
            if receipt.get(source) != expected:
                raise ContractError("RECEIPT_SCOPE_MISMATCH")
        if receipt.get("issuer") != runtime.get("adapter_id") or receipt.get("audience") != decision.get("audience"):
            raise ContractError("RECEIPT_ISSUER_AUDIENCE_INVALID")
        if approval.get("required") and receipt.get("approval_id") != approval.get("approval_id"):
            raise ContractError("RECEIPT_APPROVAL_MISMATCH")
        if receipt.get("outcome") != "SUCCEEDED" or self.verifiers[2](receipt) is not True:
            raise ContractError("RECEIPT_UNVERIFIED")

        if (evidence.get("tenant_id") != request.get("tenant_id")
                or evidence.get("operation_id") != request.get("operation_id")
                or evidence.get("object_present") is not True
                or evidence.get("retention_valid") is not True):
            raise ContractError("EVIDENCE_SCOPE_OR_AVAILABILITY_INVALID")
        if evidence.get("classification") != request.get("classification") or self.verifiers[4](evidence) is not True:
            raise ContractError("EVIDENCE_DIGEST_OR_CLASSIFICATION_INVALID")

        if (event.get("tenant_id") != request.get("tenant_id")
                or event.get("operation_id") != request.get("operation_id")
                or event.get("request_fingerprint") != fingerprint
                or event.get("decision_id") != decision.get("decision_id")
                or event.get("evidence_id") != evidence.get("evidence_id")
                or event.get("idempotency_key") != operation.get("idempotency_key")
                or event.get("outbox_committed") is not True):
            raise ContractError("EVENT_OR_OUTBOX_BINDING_INVALID")
        if approval.get("required") and event.get("approval_id") != approval.get("approval_id"):
            raise ContractError("EVENT_APPROVAL_BINDING_INVALID")
        if checkpoint.get("event_id") != event.get("event_id") or checkpoint.get("retained") is not True:
            raise ContractError("AUDIT_CHECKPOINT_SCOPE_INVALID")
        if self.verifiers[3](checkpoint) is not True:
            raise ContractError("AUDIT_CHECKPOINT_UNVERIFIED")
        return "VERIFIED_EFFECT"


class ProductionAcceptanceVerificationTests(unittest.TestCase):
    def setUp(self):
        valid = lambda item: bool(item.get("signature"))
        self.verifier = IndependentAcceptanceVerifier(
            decision_verifier=valid, approval_verifier=valid,
            receipt_verifier=valid, checkpoint_verifier=valid,
            evidence_digest_verifier=lambda item: item.get("digest") == "sha256:evidence",
        )
        self.bundle = sample_bundle()

    def test_accepts_fully_correlated_bundle(self):
        self.assertEqual(self.verifier.verify(self.bundle), "VERIFIED_EFFECT")

    def test_recomputes_fingerprint_from_authoritative_request(self):
        self.bundle["request"]["resource"] = "different-resource"
        with self.assertRaisesRegex(ContractError, "REQUEST_FINGERPRINT_MISMATCH"):
            self.verifier.verify(self.bundle)

    def test_rejects_cross_tenant_operation(self):
        self.bundle["operation"]["tenant_id"] = "tenant-b"
        with self.assertRaisesRegex(ContractError, "OPERATION_SCOPE_MISMATCH"):
            self.verifier.verify(self.bundle)

    def test_rejects_fortress_wrong_environment(self):
        self.bundle["decision"]["environment_id"] = "other-host"
        with self.assertRaisesRegex(ContractError, "DECISION_REQUEST_SCOPE_MISMATCH"):
            self.verifier.verify(self.bundle)

    def test_rejects_unverified_decision_signature(self):
        self.verifier.verifiers = (lambda item: False, *self.verifier.verifiers[1:])
        with self.assertRaisesRegex(ContractError, "DECISION_UNVERIFIED_OR_REVOKED"):
            self.verifier.verify(self.bundle)

    def test_rejects_approval_for_different_request(self):
        self.bundle["approval"]["request_fingerprint"] = "sha256:other"
        with self.assertRaisesRegex(ContractError, "APPROVAL_SCOPE_MISMATCH"):
            self.verifier.verify(self.bundle)

    def test_rejects_actor_approving_own_operation(self):
        self.bundle["approval"]["approver_id"] = self.bundle["request"]["actor_id"]
        with self.assertRaisesRegex(ContractError, "APPROVAL_SEPARATION_INVALID"):
            self.verifier.verify(self.bundle)

    def test_rejects_stale_runtime_health(self):
        self.bundle["runtime"]["health_at"] = 1
        with self.assertRaisesRegex(ContractError, "RUNTIME_HEALTH_STALE"):
            self.verifier.verify(self.bundle)

    def test_rejects_receipt_from_wrong_execution_environment(self):
        self.bundle["receipt"]["environment_id"] = "other-host"
        with self.assertRaisesRegex(ContractError, "RECEIPT_SCOPE_MISMATCH"):
            self.verifier.verify(self.bundle)

    def test_rejects_unverified_host_receipt(self):
        self.verifier.verifiers = (*self.verifier.verifiers[:2], lambda item: False, *self.verifier.verifiers[3:])
        with self.assertRaisesRegex(ContractError, "RECEIPT_UNVERIFIED"):
            self.verifier.verify(self.bundle)

    def test_rejects_missing_evidence_object(self):
        self.bundle["evidence"]["object_present"] = False
        with self.assertRaisesRegex(ContractError, "EVIDENCE_SCOPE_OR_AVAILABILITY_INVALID"):
            self.verifier.verify(self.bundle)

    def test_rejects_evidence_digest_mismatch(self):
        self.bundle["evidence"]["digest"] = "sha256:tampered"
        with self.assertRaisesRegex(ContractError, "EVIDENCE_DIGEST_OR_CLASSIFICATION_INVALID"):
            self.verifier.verify(self.bundle)

    def test_rejects_event_not_committed_to_outbox(self):
        self.bundle["event"]["outbox_committed"] = False
        with self.assertRaisesRegex(ContractError, "EVENT_OR_OUTBOX_BINDING_INVALID"):
            self.verifier.verify(self.bundle)

    def test_rejects_audit_checkpoint_for_another_event(self):
        self.bundle["checkpoint"]["event_id"] = "other-event"
        with self.assertRaisesRegex(ContractError, "AUDIT_CHECKPOINT_SCOPE_INVALID"):
            self.verifier.verify(self.bundle)

    def test_rejects_unverified_audit_checkpoint(self):
        self.verifier.verifiers = (*self.verifier.verifiers[:3], lambda item: False, self.verifier.verifiers[4])
        with self.assertRaisesRegex(ContractError, "AUDIT_CHECKPOINT_UNVERIFIED"):
            self.verifier.verify(self.bundle)

    def test_rejects_unknown_approval_requirement(self):
        self.bundle["approval"]["required"] = None
        with self.assertRaisesRegex(ContractError, "APPROVAL_REQUIREMENT_UNKNOWN"):
            self.verifier.verify(self.bundle)

    def test_rejects_operation_not_effect_verified(self):
        self.bundle["operation"]["state"] = "PENDING"
        with self.assertRaisesRegex(ContractError, "OPERATION_NOT_EFFECT_VERIFIED"):
            self.verifier.verify(self.bundle)


if __name__ == "__main__":
    unittest.main(verbosity=2)
