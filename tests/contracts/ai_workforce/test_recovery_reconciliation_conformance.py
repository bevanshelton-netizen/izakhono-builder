"""Synthetic recovery and reconciliation contract tests.

This test-only state machine models durable-outbox and execution-recovery
semantics. It is not a production database, queue, executor, receipt verifier,
or distributed recovery worker.
"""
from __future__ import annotations

import unittest
from dataclasses import dataclass
from typing import Any, Callable, Mapping


class ContractError(ValueError):
    """Stable rejection codes for this synthetic model."""


@dataclass
class Operation:
    operation_id: str
    tenant_id: str
    request_fingerprint: str
    state: str = "COMMITTED"
    outbox_event_id: str = "event-001"
    outbox_state: str = "PENDING"
    execution_attempt_id: str | None = None
    execution_state: str = "NOT_STARTED"
    receipt_id: str | None = None


class RecoveryCoordinator:
    """In-memory reference model for retries and uncertain execution outcomes."""

    def __init__(self) -> None:
        self.operations: dict[str, Operation] = {}
        self.delivered_events: set[str] = set()
        self.consumed_events: set[str] = set()

    def register_committed(self, operation: Operation) -> None:
        if not operation.operation_id or not operation.tenant_id or not operation.request_fingerprint:
            raise ContractError("OPERATION_IDENTITY_INCOMPLETE")
        if operation.operation_id in self.operations:
            raise ContractError("OPERATION_ALREADY_REGISTERED")
        if operation.state != "COMMITTED" or operation.outbox_state != "PENDING":
            raise ContractError("OPERATION_NOT_COMMITTED")
        self.operations[operation.operation_id] = operation

    def publish_outbox(
        self, operation_id: str, *,
        deliver: Callable[[str], bool] | None,
    ) -> bool:
        operation = self._operation(operation_id)
        if operation.outbox_event_id in self.delivered_events:
            operation.outbox_state = "DELIVERED"
            return False
        if deliver is None:
            raise ContractError("OUTBOX_DELIVERY_UNAVAILABLE")
        try:
            accepted = deliver(operation.outbox_event_id)
        except Exception as exc:
            operation.outbox_state = "PENDING"
            raise ContractError("OUTBOX_DELIVERY_UNCERTAIN") from exc
        if accepted is not True:
            operation.outbox_state = "PENDING"
            raise ContractError("OUTBOX_DELIVERY_NOT_ACKNOWLEDGED")
        self.delivered_events.add(operation.outbox_event_id)
        operation.outbox_state = "DELIVERED"
        return True

    def consume_event(
        self, operation_id: str, *,
        consume: Callable[[str], bool] | None,
    ) -> bool:
        operation = self._operation(operation_id)
        event_id = operation.outbox_event_id
        if event_id not in self.delivered_events:
            raise ContractError("OUTBOX_EVENT_NOT_DELIVERED")
        if event_id in self.consumed_events:
            return False
        if consume is None:
            raise ContractError("OUTBOX_CONSUMER_UNAVAILABLE")
        if consume(event_id) is not True:
            raise ContractError("OUTBOX_CONSUMER_NOT_ACKNOWLEDGED")
        self.consumed_events.add(event_id)
        operation.outbox_state = "CONSUMED"
        operation.state = "EXECUTION_PENDING"
        return True

    def record_execution_attempt(self, operation_id: str, attempt_id: str) -> None:
        operation = self._operation(operation_id)
        if operation.state != "EXECUTION_PENDING":
            raise ContractError("EXECUTION_NOT_READY")
        if not attempt_id:
            raise ContractError("EXECUTION_ATTEMPT_ID_MISSING")
        if operation.execution_state in ("STARTED", "OUTCOME_UNKNOWN", "RECONCILIATION_REQUIRED"):
            raise ContractError("EXECUTION_OUTCOME_MUST_BE_RECONCILED")
        if operation.execution_state in ("SUCCEEDED", "FAILED"):
            raise ContractError("EXECUTION_ALREADY_TERMINAL")
        operation.execution_attempt_id = attempt_id
        operation.execution_state = "STARTED"

    def mark_execution_outcome_unknown(self, operation_id: str) -> None:
        operation = self._operation(operation_id)
        if operation.execution_state != "STARTED":
            raise ContractError("EXECUTION_NOT_STARTED")
        operation.execution_state = "OUTCOME_UNKNOWN"
        operation.state = "RECONCILIATION_REQUIRED"

    def reconcile_receipt(
        self, operation_id: str, receipt: Mapping[str, Any] | None, *,
        verifier: Callable[[Mapping[str, Any]], bool] | None,
    ) -> str:
        operation = self._operation(operation_id)
        if operation.state != "RECONCILIATION_REQUIRED":
            raise ContractError("RECONCILIATION_NOT_REQUIRED")
        if not isinstance(receipt, Mapping):
            operation.execution_state = "RECONCILIATION_REQUIRED"
            raise ContractError("RECEIPT_UNAVAILABLE")
        required = (
            "receipt_id", "operation_id", "tenant_id", "request_fingerprint",
            "attempt_id", "outcome",
        )
        if any(field not in receipt or receipt[field] in (None, "") for field in required):
            operation.execution_state = "RECONCILIATION_REQUIRED"
            raise ContractError("RECEIPT_INCOMPLETE")
        if receipt["operation_id"] != operation.operation_id:
            raise ContractError("RECEIPT_OPERATION_MISMATCH")
        if receipt["tenant_id"] != operation.tenant_id:
            raise ContractError("RECEIPT_TENANT_MISMATCH")
        if receipt["request_fingerprint"] != operation.request_fingerprint:
            raise ContractError("RECEIPT_FINGERPRINT_MISMATCH")
        if receipt["attempt_id"] != operation.execution_attempt_id:
            raise ContractError("RECEIPT_ATTEMPT_MISMATCH")
        if receipt["outcome"] not in ("SUCCEEDED", "FAILED"):
            raise ContractError("RECEIPT_OUTCOME_UNKNOWN")
        if verifier is None or verifier(receipt) is not True:
            operation.execution_state = "RECONCILIATION_REQUIRED"
            raise ContractError("RECEIPT_NOT_VERIFIED")
        operation.receipt_id = receipt["receipt_id"]
        operation.execution_state = receipt["outcome"]
        operation.state = "ACKNOWLEDGED" if receipt["outcome"] == "SUCCEEDED" else "FAILED"
        return operation.state

    def _operation(self, operation_id: str) -> Operation:
        if not operation_id or operation_id not in self.operations:
            raise ContractError("OPERATION_NOT_FOUND")
        return self.operations[operation_id]


class OutboxRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.coordinator = RecoveryCoordinator()
        self.operation = Operation("op-1", "tenant-a", "sha256:request")
        self.coordinator.register_committed(self.operation)

    def test_committed_operation_starts_with_pending_outbox(self):
        self.assertEqual(self.operation.state, "COMMITTED")
        self.assertEqual(self.operation.outbox_state, "PENDING")

    def test_missing_delivery_adapter_keeps_event_pending(self):
        with self.assertRaisesRegex(ContractError, "OUTBOX_DELIVERY_UNAVAILABLE"):
            self.coordinator.publish_outbox("op-1", deliver=None)
        self.assertEqual(self.operation.outbox_state, "PENDING")

    def test_unacknowledged_delivery_remains_retryable(self):
        with self.assertRaisesRegex(ContractError, "OUTBOX_DELIVERY_NOT_ACKNOWLEDGED"):
            self.coordinator.publish_outbox("op-1", deliver=lambda event: False)
        self.assertEqual(self.operation.outbox_state, "PENDING")

    def test_uncertain_delivery_remains_pending_for_idempotent_retry(self):
        def lost_ack(_event):
            raise TimeoutError("synthetic lost acknowledgement")
        with self.assertRaisesRegex(ContractError, "OUTBOX_DELIVERY_UNCERTAIN"):
            self.coordinator.publish_outbox("op-1", deliver=lost_ack)
        self.assertEqual(self.operation.outbox_state, "PENDING")

    def test_successful_delivery_is_recorded(self):
        calls = []
        result = self.coordinator.publish_outbox("op-1", deliver=lambda event: calls.append(event) or True)
        self.assertTrue(result)
        self.assertEqual(self.operation.outbox_state, "DELIVERED")
        self.assertEqual(calls, ["event-001"])

    def test_retry_after_lost_delivery_ack_uses_same_stable_event_id(self):
        attempts = []
        def delivery(event):
            attempts.append(event)
            if len(attempts) == 1:
                raise TimeoutError("synthetic lost acknowledgement")
            return True
        with self.assertRaisesRegex(ContractError, "OUTBOX_DELIVERY_UNCERTAIN"):
            self.coordinator.publish_outbox("op-1", deliver=delivery)
        self.assertTrue(self.coordinator.publish_outbox("op-1", deliver=delivery))
        self.assertEqual(attempts, ["event-001", "event-001"])
        self.assertEqual(self.operation.outbox_state, "DELIVERED")

    def test_repeated_delivery_does_not_republish_recorded_event(self):
        calls = []
        deliver = lambda event: calls.append(event) or True
        self.coordinator.publish_outbox("op-1", deliver=deliver)
        result = self.coordinator.publish_outbox("op-1", deliver=deliver)
        self.assertFalse(result)
        self.assertEqual(calls, ["event-001"])

    def test_consumer_cannot_process_undelivered_event(self):
        with self.assertRaisesRegex(ContractError, "OUTBOX_EVENT_NOT_DELIVERED"):
            self.coordinator.consume_event("op-1", consume=lambda event: True)

    def test_consumer_failure_does_not_advance_operation(self):
        self.coordinator.publish_outbox("op-1", deliver=lambda event: True)
        with self.assertRaisesRegex(ContractError, "OUTBOX_CONSUMER_NOT_ACKNOWLEDGED"):
            self.coordinator.consume_event("op-1", consume=lambda event: False)
        self.assertEqual(self.operation.state, "COMMITTED")

    def test_consumer_retry_is_idempotent_after_acknowledgement(self):
        self.coordinator.publish_outbox("op-1", deliver=lambda event: True)
        calls = []
        first = self.coordinator.consume_event("op-1", consume=lambda event: calls.append(event) or True)
        second = self.coordinator.consume_event("op-1", consume=lambda event: calls.append(event) or True)
        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(calls, ["event-001"])
        self.assertEqual(self.operation.state, "EXECUTION_PENDING")


class ExecutionReconciliationTests(unittest.TestCase):
    def setUp(self):
        self.coordinator = RecoveryCoordinator()
        self.operation = Operation("op-1", "tenant-a", "sha256:request")
        self.coordinator.register_committed(self.operation)
        self.coordinator.publish_outbox("op-1", deliver=lambda event: True)
        self.coordinator.consume_event("op-1", consume=lambda event: True)
        self.coordinator.record_execution_attempt("op-1", "attempt-1")

    def receipt(self, **changes):
        value = {
            "receipt_id": "receipt-1", "operation_id": "op-1",
            "tenant_id": "tenant-a", "request_fingerprint": "sha256:request",
            "attempt_id": "attempt-1", "outcome": "SUCCEEDED",
        }
        value.update(changes)
        return value

    def test_unknown_execution_outcome_requires_reconciliation(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        self.assertEqual(self.operation.state, "RECONCILIATION_REQUIRED")
        with self.assertRaisesRegex(ContractError, "EXECUTION_OUTCOME_MUST_BE_RECONCILED"):
            self.coordinator.record_execution_attempt("op-1", "attempt-2")

    def test_missing_receipt_keeps_reconciliation_required(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_UNAVAILABLE"):
            self.coordinator.reconcile_receipt("op-1", None, verifier=None)
        self.assertEqual(self.operation.state, "RECONCILIATION_REQUIRED")

    def test_incomplete_receipt_is_rejected(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_INCOMPLETE"):
            self.coordinator.reconcile_receipt("op-1", {"receipt_id": "r"}, verifier=lambda r: True)

    def test_cross_tenant_receipt_is_rejected(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_TENANT_MISMATCH"):
            self.coordinator.reconcile_receipt("op-1", self.receipt(tenant_id="tenant-b"),
                                               verifier=lambda r: True)

    def test_wrong_operation_receipt_is_rejected(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_OPERATION_MISMATCH"):
            self.coordinator.reconcile_receipt("op-1", self.receipt(operation_id="op-other"),
                                               verifier=lambda r: True)

    def test_wrong_fingerprint_receipt_is_rejected(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_FINGERPRINT_MISMATCH"):
            self.coordinator.reconcile_receipt("op-1", self.receipt(request_fingerprint="sha256:other"),
                                               verifier=lambda r: True)

    def test_wrong_attempt_receipt_is_rejected(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_ATTEMPT_MISMATCH"):
            self.coordinator.reconcile_receipt("op-1", self.receipt(attempt_id="attempt-other"),
                                               verifier=lambda r: True)

    def test_unknown_outcome_is_rejected(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_OUTCOME_UNKNOWN"):
            self.coordinator.reconcile_receipt("op-1", self.receipt(outcome="MAYBE"),
                                               verifier=lambda r: True)

    def test_unverified_receipt_cannot_complete_operation(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        with self.assertRaisesRegex(ContractError, "RECEIPT_NOT_VERIFIED"):
            self.coordinator.reconcile_receipt("op-1", self.receipt(), verifier=None)
        self.assertEqual(self.operation.state, "RECONCILIATION_REQUIRED")

    def test_verified_success_receipt_acknowledges_operation(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        state = self.coordinator.reconcile_receipt(
            "op-1", self.receipt(), verifier=lambda receipt: receipt["receipt_id"] == "receipt-1",
        )
        self.assertEqual(state, "ACKNOWLEDGED")
        self.assertEqual(self.operation.receipt_id, "receipt-1")

    def test_verified_failure_receipt_marks_operation_failed(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        state = self.coordinator.reconcile_receipt(
            "op-1", self.receipt(outcome="FAILED"), verifier=lambda receipt: True,
        )
        self.assertEqual(state, "FAILED")

    def test_terminal_operation_cannot_be_reconciled_again(self):
        self.coordinator.mark_execution_outcome_unknown("op-1")
        self.coordinator.reconcile_receipt("op-1", self.receipt(), verifier=lambda receipt: True)
        with self.assertRaisesRegex(ContractError, "RECONCILIATION_NOT_REQUIRED"):
            self.coordinator.reconcile_receipt("op-1", self.receipt(), verifier=lambda receipt: True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
