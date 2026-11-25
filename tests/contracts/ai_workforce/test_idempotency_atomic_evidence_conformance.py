"""Synthetic idempotency and atomic evidence contract tests.

Test-only reference model. It uses in-memory Python dictionaries and injected
failure points; it is not a database transaction, durable outbox, distributed
lock, or production idempotency implementation.
"""
from __future__ import annotations

import copy
import unittest
from dataclasses import dataclass
from typing import Any, Callable, Mapping


class ContractError(ValueError):
    """Stable rejection codes for this synthetic test model."""


@dataclass(frozen=True)
class OperationRequest:
    tenant_id: str
    idempotency_key: str
    request_fingerprint: str
    actor_id: str
    action: str


@dataclass(frozen=True)
class OperationResult:
    operation_id: str
    tenant_id: str
    request_fingerprint: str
    state: str
    evidence_id: str | None


def validate_request(request: OperationRequest) -> None:
    for field in ("tenant_id", "idempotency_key", "request_fingerprint", "actor_id", "action"):
        value = getattr(request, field)
        if not isinstance(value, str) or not value.strip():
            raise ContractError(f"REQUEST_{field.upper()}_MISSING")


class IdempotencyLedger:
    """In-memory model of tenant-scoped idempotency-key semantics."""

    def __init__(self) -> None:
        self._entries: dict[tuple[str, str], tuple[str, OperationResult]] = {}

    def resolve(
        self, request: OperationRequest, *,
        create: Callable[[], OperationResult],
    ) -> tuple[OperationResult, bool]:
        validate_request(request)
        key = (request.tenant_id, request.idempotency_key)
        existing = self._entries.get(key)
        if existing is not None:
            fingerprint, result = existing
            if fingerprint != request.request_fingerprint:
                raise ContractError("IDEMPOTENCY_CONFLICT")
            return result, False

        result = create()
        if (result.tenant_id != request.tenant_id
                or result.request_fingerprint != request.request_fingerprint):
            raise ContractError("OPERATION_RESULT_SCOPE_MISMATCH")
        self._entries[key] = (request.request_fingerprint, result)
        return result, True


class AtomicEvidenceStore:
    """Copy-on-write model: operation state and evidence commit as one unit."""

    def __init__(self) -> None:
        self.operations: dict[str, dict[str, Any]] = {}
        self.evidence: dict[str, dict[str, Any]] = {}
        self.outbox: dict[str, dict[str, Any]] = {}

    def commit_consequential_operation(
        self, *, operation: Mapping[str, Any], evidence: Mapping[str, Any],
        outbox_event: Mapping[str, Any],
        failure_point: str | None = None,
    ) -> None:
        required_operation = ("operation_id", "tenant_id", "request_fingerprint", "state")
        required_evidence = ("evidence_id", "tenant_id", "operation_id", "digest")
        required_event = ("event_id", "tenant_id", "operation_id", "event_type")
        for label, value, fields in (
            ("OPERATION", operation, required_operation),
            ("EVIDENCE", evidence, required_evidence),
            ("OUTBOX_EVENT", outbox_event, required_event),
        ):
            if not isinstance(value, Mapping) or any(
                field not in value or value[field] in (None, "") for field in fields
            ):
                raise ContractError(f"{label}_INCOMPLETE")

        tenant_id = operation["tenant_id"]
        operation_id = operation["operation_id"]
        if evidence["tenant_id"] != tenant_id or outbox_event["tenant_id"] != tenant_id:
            raise ContractError("TRANSACTION_TENANT_MISMATCH")
        if evidence["operation_id"] != operation_id or outbox_event["operation_id"] != operation_id:
            raise ContractError("TRANSACTION_OPERATION_MISMATCH")
        if operation_id in self.operations or evidence["evidence_id"] in self.evidence:
            raise ContractError("TRANSACTION_DUPLICATE_ID")
        if outbox_event["event_id"] in self.outbox:
            raise ContractError("TRANSACTION_DUPLICATE_EVENT")

        # Stage all three records before publishing any mutation.
        staged_operations = copy.deepcopy(self.operations)
        staged_evidence = copy.deepcopy(self.evidence)
        staged_outbox = copy.deepcopy(self.outbox)
        staged_operations[operation_id] = dict(operation)
        if failure_point == "after_operation_stage":
            raise ContractError("TRANSACTION_ABORTED")
        staged_evidence[evidence["evidence_id"]] = dict(evidence)
        if failure_point == "after_evidence_stage":
            raise ContractError("TRANSACTION_ABORTED")
        staged_outbox[outbox_event["event_id"]] = dict(outbox_event)
        if failure_point == "before_commit":
            raise ContractError("TRANSACTION_ABORTED")

        self.operations = staged_operations
        self.evidence = staged_evidence
        self.outbox = staged_outbox


class IdempotencyContractTests(unittest.TestCase):
    def setUp(self):
        self.ledger = IdempotencyLedger()
        self.request = OperationRequest(
            tenant_id="tenant-a", idempotency_key="idem-001",
            request_fingerprint="sha256:request-a",
            actor_id="principal:operator-a", action="agent.pause",
        )
        self.created = []

    def create_result(self):
        result = OperationResult(
            operation_id="operation-001", tenant_id="tenant-a",
            request_fingerprint="sha256:request-a", state="ACKNOWLEDGED",
            evidence_id="evidence-001",
        )
        self.created.append(result)
        return result

    def test_first_request_creates_operation(self):
        result, created = self.ledger.resolve(self.request, create=self.create_result)
        self.assertTrue(created)
        self.assertEqual(result.operation_id, "operation-001")
        self.assertEqual(len(self.created), 1)

    def test_same_tenant_key_and_fingerprint_returns_original_result(self):
        first, first_created = self.ledger.resolve(self.request, create=self.create_result)
        second, second_created = self.ledger.resolve(self.request, create=self.create_result)
        self.assertTrue(first_created)
        self.assertFalse(second_created)
        self.assertEqual(second, first)
        self.assertEqual(len(self.created), 1)

    def test_same_key_with_different_fingerprint_conflicts(self):
        self.ledger.resolve(self.request, create=self.create_result)
        changed = OperationRequest(
            tenant_id="tenant-a", idempotency_key="idem-001",
            request_fingerprint="sha256:changed",
            actor_id="principal:operator-a", action="agent.pause",
        )
        with self.assertRaisesRegex(ContractError, "IDEMPOTENCY_CONFLICT"):
            self.ledger.resolve(changed, create=self.create_result)

    def test_same_key_in_another_tenant_is_a_separate_namespace(self):
        self.ledger.resolve(self.request, create=self.create_result)
        other_tenant = OperationRequest(
            tenant_id="tenant-b", idempotency_key="idem-001",
            request_fingerprint="sha256:request-b",
            actor_id="principal:operator-b", action="agent.pause",
        )
        other_result = OperationResult(
            operation_id="operation-002", tenant_id="tenant-b",
            request_fingerprint="sha256:request-b", state="ACKNOWLEDGED",
            evidence_id="evidence-002",
        )
        result, created = self.ledger.resolve(other_tenant, create=lambda: other_result)
        self.assertTrue(created)
        self.assertEqual(result.tenant_id, "tenant-b")

    def test_result_with_wrong_tenant_or_fingerprint_is_rejected(self):
        wrong = OperationResult(
            operation_id="operation-x", tenant_id="tenant-b",
            request_fingerprint="sha256:request-a", state="ACKNOWLEDGED",
            evidence_id="evidence-x",
        )
        with self.assertRaisesRegex(ContractError, "OPERATION_RESULT_SCOPE_MISMATCH"):
            self.ledger.resolve(self.request, create=lambda: wrong)

    def test_missing_idempotency_context_fails_closed(self):
        invalid = OperationRequest(
            tenant_id="tenant-a", idempotency_key="",
            request_fingerprint="sha256:request-a",
            actor_id="principal:operator-a", action="agent.pause",
        )
        with self.assertRaisesRegex(ContractError, "REQUEST_IDEMPOTENCY_KEY_MISSING"):
            self.ledger.resolve(invalid, create=self.create_result)


class AtomicEvidenceContractTests(unittest.TestCase):
    def setUp(self):
        self.store = AtomicEvidenceStore()
        self.operation = {
            "operation_id": "operation-001", "tenant_id": "tenant-a",
            "request_fingerprint": "sha256:request-a", "state": "ACKNOWLEDGED",
        }
        self.evidence = {
            "evidence_id": "evidence-001", "tenant_id": "tenant-a",
            "operation_id": "operation-001", "digest": "sha256:evidence",
        }
        self.event = {
            "event_id": "event-001", "tenant_id": "tenant-a",
            "operation_id": "operation-001", "event_type": "operation.acknowledged",
        }

    def commit(self, **kwargs):
        self.store.commit_consequential_operation(
            operation=self.operation, evidence=self.evidence,
            outbox_event=self.event, **kwargs,
        )

    def assert_empty(self):
        self.assertEqual(self.store.operations, {})
        self.assertEqual(self.store.evidence, {})
        self.assertEqual(self.store.outbox, {})

    def test_commits_state_evidence_and_outbox_together(self):
        self.commit()
        self.assertIn("operation-001", self.store.operations)
        self.assertIn("evidence-001", self.store.evidence)
        self.assertIn("event-001", self.store.outbox)

    def test_failure_after_operation_stage_commits_nothing(self):
        with self.assertRaisesRegex(ContractError, "TRANSACTION_ABORTED"):
            self.commit(failure_point="after_operation_stage")
        self.assert_empty()

    def test_failure_after_evidence_stage_commits_nothing(self):
        with self.assertRaisesRegex(ContractError, "TRANSACTION_ABORTED"):
            self.commit(failure_point="after_evidence_stage")
        self.assert_empty()

    def test_failure_before_commit_commits_nothing(self):
        with self.assertRaisesRegex(ContractError, "TRANSACTION_ABORTED"):
            self.commit(failure_point="before_commit")
        self.assert_empty()

    def test_cross_tenant_evidence_aborts_entire_transaction(self):
        evidence = dict(self.evidence, tenant_id="tenant-b")
        with self.assertRaisesRegex(ContractError, "TRANSACTION_TENANT_MISMATCH"):
            self.store.commit_consequential_operation(
                operation=self.operation, evidence=evidence, outbox_event=self.event,
            )
        self.assert_empty()

    def test_evidence_for_another_operation_aborts_entire_transaction(self):
        evidence = dict(self.evidence, operation_id="operation-other")
        with self.assertRaisesRegex(ContractError, "TRANSACTION_OPERATION_MISMATCH"):
            self.store.commit_consequential_operation(
                operation=self.operation, evidence=evidence, outbox_event=self.event,
            )
        self.assert_empty()

    def test_outbox_event_for_another_operation_aborts_entire_transaction(self):
        event = dict(self.event, operation_id="operation-other")
        with self.assertRaisesRegex(ContractError, "TRANSACTION_OPERATION_MISMATCH"):
            self.store.commit_consequential_operation(
                operation=self.operation, evidence=self.evidence, outbox_event=event,
            )
        self.assert_empty()

    def test_duplicate_operation_cannot_overwrite_prior_evidence(self):
        self.commit()
        before = copy.deepcopy(self.store.evidence)
        with self.assertRaisesRegex(ContractError, "TRANSACTION_DUPLICATE_ID"):
            self.commit()
        self.assertEqual(self.store.evidence, before)

    def test_duplicate_outbox_event_is_rejected(self):
        self.store.outbox["event-001"] = dict(self.event)
        with self.assertRaisesRegex(ContractError, "TRANSACTION_DUPLICATE_EVENT"):
            self.commit()
        self.assertEqual(self.store.operations, {})
        self.assertEqual(self.store.evidence, {})

    def test_unknown_or_incomplete_evidence_fails_closed(self):
        with self.assertRaisesRegex(ContractError, "EVIDENCE_INCOMPLETE"):
            self.store.commit_consequential_operation(
                operation=self.operation, evidence={"evidence_id": "evidence-001"},
                outbox_event=self.event,
            )
        self.assert_empty()


if __name__ == "__main__":
    unittest.main(verbosity=2)
