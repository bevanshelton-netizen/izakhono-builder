"""Synthetic operator escalation and recovery-ownership contract tests.

The model is intentionally in-memory and does not authorize real recovery,
retry, cancellation, evidence mutation, or execution.
"""
from __future__ import annotations

import unittest
from dataclasses import dataclass, field
from typing import Any, Callable, Mapping


class ContractError(ValueError):
    pass


@dataclass
class RecoveryCase:
    operation_id: str
    tenant_id: str
    request_fingerprint: str
    state: str = "RECONCILIATION_REQUIRED"
    execution_attempts: int = 1
    max_execution_attempts: int = 2
    last_attempt_at: int = 100
    next_retry_at: int | None = None
    escalation_reason: str | None = None
    assigned_operator: str | None = None
    preserved_evidence: set[str] = field(default_factory=set)
    resolution: str | None = None


class RecoveryGovernance:
    """Reference rules for escalation, scoped operator decisions and retry limits."""

    def __init__(self, cases: list[RecoveryCase] | None = None):
        self.cases = {case.operation_id: case for case in (cases or [])}

    def _case(self, operation_id: str) -> RecoveryCase:
        if operation_id not in self.cases:
            raise ContractError("RECOVERY_CASE_NOT_FOUND")
        return self.cases[operation_id]

    def schedule_retry(
        self, operation_id: str, *, now: int, backoff_seconds: int,
        retry_policy_verified: bool,
    ) -> int:
        case = self._case(operation_id)
        if case.state != "RETRY_ELIGIBLE":
            raise ContractError("RECOVERY_NOT_RETRY_ELIGIBLE")
        if retry_policy_verified is not True:
            raise ContractError("RETRY_POLICY_UNVERIFIED")
        if case.execution_attempts >= case.max_execution_attempts:
            case.state = "ESCALATION_REQUIRED"
            case.escalation_reason = "RETRY_BUDGET_EXHAUSTED"
            raise ContractError("RETRY_BUDGET_EXHAUSTED")
        if isinstance(backoff_seconds, bool) or backoff_seconds <= 0:
            raise ContractError("RETRY_BACKOFF_INVALID")
        if now < case.last_attempt_at:
            raise ContractError("RECOVERY_CLOCK_INVALID")
        case.next_retry_at = now + backoff_seconds
        case.state = "RETRY_SCHEDULED"
        return case.next_retry_at

    def escalate(self, operation_id: str, *, reason: str, operator_id: str | None = None) -> None:
        case = self._case(operation_id)
        allowed = {
            "RETRY_BUDGET_EXHAUSTED", "STALE_OPERATION", "RECEIPT_UNAVAILABLE",
            "CONFLICTING_RECEIPTS", "EXECUTOR_STATUS_UNAVAILABLE",
            "EVIDENCE_ACKNOWLEDGEMENT_MISSING", "INTEGRITY_FAILURE",
        }
        if reason not in allowed:
            raise ContractError("ESCALATION_REASON_INVALID")
        if case.state in ("RESOLVED", "CLOSED"):
            raise ContractError("RECOVERY_CASE_TERMINAL")
        case.state = "ESCALATION_REQUIRED"
        case.escalation_reason = reason
        case.assigned_operator = operator_id

    def preserve_evidence(self, operation_id: str, evidence_ids: set[str]) -> None:
        case = self._case(operation_id)
        if case.state not in ("ESCALATION_REQUIRED", "RECONCILIATION_REQUIRED"):
            raise ContractError("EVIDENCE_PRESERVATION_NOT_ALLOWED")
        if not evidence_ids or any(not item for item in evidence_ids):
            raise ContractError("EVIDENCE_REFERENCE_INVALID")
        case.preserved_evidence.update(evidence_ids)

    def resolve(
        self, operation_id: str, *, operator_id: str, tenant_id: str,
        request_fingerprint: str, action: str, approval: Mapping[str, Any] | None,
        approval_verifier: Callable[[Mapping[str, Any]], bool] | None,
        required_evidence: set[str],
    ) -> str:
        case = self._case(operation_id)
        if case.state != "ESCALATION_REQUIRED":
            raise ContractError("ESCALATION_NOT_ACTIVE")
        if not operator_id or operator_id == case.operation_id:
            raise ContractError("OPERATOR_IDENTITY_INVALID")
        if case.assigned_operator and operator_id != case.assigned_operator:
            raise ContractError("OPERATOR_NOT_ASSIGNED")
        if tenant_id != case.tenant_id:
            raise ContractError("OPERATOR_TENANT_MISMATCH")
        if request_fingerprint != case.request_fingerprint:
            raise ContractError("OPERATOR_FINGERPRINT_MISMATCH")
        if not required_evidence or not required_evidence.issubset(case.preserved_evidence):
            raise ContractError("RECOVERY_EVIDENCE_INCOMPLETE")
        if action not in ("RETURN_TO_RECONCILIATION", "CLOSE_AS_UNRESOLVED"):
            raise ContractError("RECOVERY_ACTION_NOT_ALLOWED")
        if not isinstance(approval, Mapping) or approval_verifier is None:
            raise ContractError("RECOVERY_APPROVAL_UNAVAILABLE")
        if approval_verifier(approval) is not True:
            raise ContractError("RECOVERY_APPROVAL_UNVERIFIED")
        if approval.get("tenant_id") != case.tenant_id:
            raise ContractError("RECOVERY_APPROVAL_TENANT_MISMATCH")
        if approval.get("operation_id") != case.operation_id:
            raise ContractError("RECOVERY_APPROVAL_OPERATION_MISMATCH")
        if approval.get("request_fingerprint") != case.request_fingerprint:
            raise ContractError("RECOVERY_APPROVAL_FINGERPRINT_MISMATCH")
        if approval.get("approver_id") == operator_id:
            raise ContractError("RECOVERY_SELF_APPROVAL")
        case.resolution = action
        case.state = "RECONCILIATION_REQUIRED" if action == "RETURN_TO_RECONCILIATION" else "CLOSED"
        return case.state


class RetryBudgetTests(unittest.TestCase):
    def setUp(self):
        self.case = RecoveryCase("op-1", "tenant-a", "sha256:fp", state="RETRY_ELIGIBLE")
        self.gov = RecoveryGovernance([self.case])

    def test_retry_requires_verified_policy(self):
        with self.assertRaisesRegex(ContractError, "RETRY_POLICY_UNVERIFIED"):
            self.gov.schedule_retry("op-1", now=110, backoff_seconds=10, retry_policy_verified=False)

    def test_retry_observes_positive_backoff(self):
        with self.assertRaisesRegex(ContractError, "RETRY_BACKOFF_INVALID"):
            self.gov.schedule_retry("op-1", now=110, backoff_seconds=0, retry_policy_verified=True)

    def test_retry_backoff_is_calculated_from_current_time(self):
        result = self.gov.schedule_retry("op-1", now=110, backoff_seconds=30, retry_policy_verified=True)
        self.assertEqual(result, 140)
        self.assertEqual(self.case.state, "RETRY_SCHEDULED")

    def test_retry_rejects_clock_rollback(self):
        with self.assertRaisesRegex(ContractError, "RECOVERY_CLOCK_INVALID"):
            self.gov.schedule_retry("op-1", now=99, backoff_seconds=10, retry_policy_verified=True)

    def test_retry_budget_exhaustion_escalates(self):
        self.case.execution_attempts = self.case.max_execution_attempts
        with self.assertRaisesRegex(ContractError, "RETRY_BUDGET_EXHAUSTED"):
            self.gov.schedule_retry("op-1", now=110, backoff_seconds=10, retry_policy_verified=True)
        self.assertEqual(self.case.state, "ESCALATION_REQUIRED")
        self.assertEqual(self.case.escalation_reason, "RETRY_BUDGET_EXHAUSTED")

    def test_retry_not_allowed_for_unknown_state(self):
        self.case.state = "RECONCILIATION_REQUIRED"
        with self.assertRaisesRegex(ContractError, "RECOVERY_NOT_RETRY_ELIGIBLE"):
            self.gov.schedule_retry("op-1", now=110, backoff_seconds=10, retry_policy_verified=True)


class OperatorEscalationTests(unittest.TestCase):
    def setUp(self):
        self.case = RecoveryCase("op-1", "tenant-a", "sha256:fp")
        self.gov = RecoveryGovernance([self.case])
        self.gov.escalate("op-1", reason="STALE_OPERATION", operator_id="operator-a")
        self.gov.preserve_evidence("op-1", {"event-1", "receipt-query-1"})
        self.approval = {
            "tenant_id": "tenant-a", "operation_id": "op-1",
            "request_fingerprint": "sha256:fp", "approver_id": "supervisor-b",
        }
        self.verify = lambda approval: approval.get("approver_id") == "supervisor-b"

    def resolve(self, **changes):
        args = {
            "operator_id": "operator-a", "tenant_id": "tenant-a",
            "request_fingerprint": "sha256:fp",
            "action": "RETURN_TO_RECONCILIATION",
            "approval": self.approval, "approval_verifier": self.verify,
            "required_evidence": {"event-1", "receipt-query-1"},
        }
        args.update(changes)
        return self.gov.resolve("op-1", **args)

    def test_stale_operation_can_be_escalated(self):
        self.assertEqual(self.case.state, "ESCALATION_REQUIRED")
        self.assertEqual(self.case.escalation_reason, "STALE_OPERATION")
        self.assertEqual(self.case.assigned_operator, "operator-a")

    def test_unknown_escalation_reason_rejected(self):
        with self.assertRaisesRegex(ContractError, "ESCALATION_REASON_INVALID"):
            self.gov.escalate("op-1", reason="JUST_RETRY_IT")

    def test_evidence_must_be_preserved_before_resolution(self):
        self.case.preserved_evidence.clear()
        with self.assertRaisesRegex(ContractError, "RECOVERY_EVIDENCE_INCOMPLETE"):
            self.resolve()

    def test_wrong_operator_cannot_take_assigned_case(self):
        with self.assertRaisesRegex(ContractError, "OPERATOR_NOT_ASSIGNED"):
            self.resolve(operator_id="operator-c")

    def test_cross_tenant_operator_context_rejected(self):
        with self.assertRaisesRegex(ContractError, "OPERATOR_TENANT_MISMATCH"):
            self.resolve(tenant_id="tenant-b")

    def test_changed_request_fingerprint_rejected(self):
        with self.assertRaisesRegex(ContractError, "OPERATOR_FINGERPRINT_MISMATCH"):
            self.resolve(request_fingerprint="sha256:altered")

    def test_resolution_requires_independent_approval(self):
        with self.assertRaisesRegex(ContractError, "RECOVERY_APPROVAL_UNAVAILABLE"):
            self.resolve(approval=None)

    def test_unverified_approval_rejected(self):
        with self.assertRaisesRegex(ContractError, "RECOVERY_APPROVAL_UNVERIFIED"):
            self.resolve(approval_verifier=lambda approval: False)

    def test_approval_must_match_operation_and_tenant_scope(self):
        bad = dict(self.approval, operation_id="op-other")
        with self.assertRaisesRegex(ContractError, "RECOVERY_APPROVAL_OPERATION_MISMATCH"):
            self.resolve(approval=bad)

    def test_operator_cannot_approve_own_recovery_action(self):
        bad = dict(self.approval, approver_id="operator-a")
        with self.assertRaisesRegex(ContractError, "RECOVERY_SELF_APPROVAL"):
            self.resolve(approval=bad, approval_verifier=lambda approval: True)

    def test_operator_cannot_claim_success_as_resolution(self):
        with self.assertRaisesRegex(ContractError, "RECOVERY_ACTION_NOT_ALLOWED"):
            self.resolve(action="MARK_SUCCEEDED")

    def test_return_to_reconciliation_does_not_claim_completion(self):
        state = self.resolve()
        self.assertEqual(state, "RECONCILIATION_REQUIRED")
        self.assertEqual(self.case.resolution, "RETURN_TO_RECONCILIATION")

    def test_close_as_unresolved_preserves_unresolved_outcome(self):
        state = self.resolve(action="CLOSE_AS_UNRESOLVED")
        self.assertEqual(state, "CLOSED")
        self.assertEqual(self.case.resolution, "CLOSE_AS_UNRESOLVED")

    def test_closed_case_cannot_be_reopened_by_escalation(self):
        self.resolve(action="CLOSE_AS_UNRESOLVED")
        with self.assertRaisesRegex(ContractError, "RECOVERY_CASE_TERMINAL"):
            self.gov.escalate("op-1", reason="STALE_OPERATION")


if __name__ == "__main__":
    unittest.main(verbosity=2)
