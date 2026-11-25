"""Synthetic recovery audit/evidence conformance reference model.

This module uses an in-memory hash chain and injected checkpoint verifier.
It is not immutable storage, a cryptographic implementation, or a production
audit service.
"""
from __future__ import annotations

import copy
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


class RecoveryAuditLedger:
    """Append-only-by-contract test ledger with verifiable sequence/hash links."""

    def __init__(self, checkpoint_verifier: Callable[[Mapping[str, Any]], bool]):
        self._records: list[dict[str, Any]] = []
        self._checkpoint_verifier = checkpoint_verifier

    @property
    def records(self) -> tuple[dict[str, Any], ...]:
        return tuple(copy.deepcopy(self._records))

    def append(self, event: Mapping[str, Any], checkpoint: Mapping[str, Any]) -> str:
        candidate = copy.deepcopy(dict(event))
        self._validate_event(candidate)
        expected_sequence = len(self._records) + 1
        previous_hash = self._records[-1]["event_hash"] if self._records else "GENESIS"
        if candidate.get("sequence") != expected_sequence:
            raise ContractError("AUDIT_SEQUENCE_INVALID")
        if candidate.get("previous_event_hash") != previous_hash:
            raise ContractError("AUDIT_PREVIOUS_HASH_MISMATCH")
        if self._records and candidate["occurred_at"] <= self._records[-1]["occurred_at"]:
            raise ContractError("AUDIT_TIME_NOT_MONOTONIC")
        checkpoint_copy = copy.deepcopy(dict(checkpoint))
        if checkpoint_copy.get("sequence") != expected_sequence:
            raise ContractError("CHECKPOINT_SEQUENCE_MISMATCH")
        if checkpoint_copy.get("event_hash") != digest(canonical(candidate)):
            raise ContractError("CHECKPOINT_EVENT_HASH_MISMATCH")
        if self._checkpoint_verifier(checkpoint_copy) is not True:
            raise ContractError("CHECKPOINT_UNVERIFIED")
        record = dict(candidate)
        record["event_hash"] = digest(canonical(candidate))
        self._records.append(record)
        return record["event_hash"]

    def verify(self) -> bool:
        previous_hash = "GENESIS"
        previous_time = 0
        for index, record in enumerate(self._records, start=1):
            event = {key: value for key, value in record.items() if key != "event_hash"}
            self._validate_event(event)
            if event.get("sequence") != index:
                raise ContractError("AUDIT_SEQUENCE_INVALID")
            if event.get("previous_event_hash") != previous_hash:
                raise ContractError("AUDIT_PREVIOUS_HASH_MISMATCH")
            if event.get("occurred_at", 0) <= previous_time:
                raise ContractError("AUDIT_TIME_NOT_MONOTONIC")
            actual = digest(canonical(event))
            if record.get("event_hash") != actual:
                raise ContractError("AUDIT_EVENT_MUTATED")
            previous_hash = actual
            previous_time = event["occurred_at"]
        return True

    @staticmethod
    def _validate_event(event: Mapping[str, Any]) -> None:
        required = (
            "event_id", "case_id", "operation_id", "tenant_id",
            "request_fingerprint", "event_type", "occurred_at", "sequence",
            "previous_event_hash", "initiator", "operator_id", "approver_id",
            "reason", "requested_action", "approval_decision_id",
            "policy_version", "evidence", "reconciliation_query_ids",
            "receipt_verification", "execution_attempt_id", "disposition",
            "outcome_certainty",
        )
        if any(key not in event or event[key] is None for key in required):
            raise ContractError("AUDIT_FIELD_MISSING")
        if not all(isinstance(event[key], str) and event[key].strip() for key in (
            "event_id", "case_id", "operation_id", "tenant_id",
            "request_fingerprint", "event_type", "previous_event_hash",
            "operator_id", "approver_id", "reason", "requested_action",
            "approval_decision_id", "policy_version", "execution_attempt_id",
            "disposition", "outcome_certainty",
        )):
            raise ContractError("AUDIT_FIELD_INVALID")
        if isinstance(event["sequence"], bool) or not isinstance(event["sequence"], int) or event["sequence"] < 1:
            raise ContractError("AUDIT_SEQUENCE_INVALID")
        if isinstance(event["occurred_at"], bool) or not isinstance(event["occurred_at"], int) or event["occurred_at"] <= 0:
            raise ContractError("AUDIT_TIME_INVALID")
        initiator = event["initiator"]
        if not isinstance(initiator, Mapping) or not all(
            isinstance(initiator.get(key), str) and initiator[key].strip()
            for key in ("principal_id", "session_id", "actor_type")
        ):
            raise ContractError("AUDIT_INITIATOR_UNAUTHENTICATED")
        if event["operator_id"] == event["approver_id"]:
            raise ContractError("AUDIT_OPERATOR_SELF_APPROVAL")
        evidence = event["evidence"]
        if not isinstance(evidence, list) or not evidence:
            raise ContractError("AUDIT_EVIDENCE_MISSING")
        seen: set[str] = set()
        for item in evidence:
            if not isinstance(item, Mapping):
                raise ContractError("AUDIT_EVIDENCE_INVALID")
            if item.get("tenant_id") != event["tenant_id"] or item.get("operation_id") != event["operation_id"]:
                raise ContractError("AUDIT_EVIDENCE_SCOPE_MISMATCH")
            if not all(isinstance(item.get(key), str) and item[key].strip() for key in (
                "evidence_id", "source", "content_digest"
            )):
                raise ContractError("AUDIT_EVIDENCE_DIGEST_MISSING")
            if not item["content_digest"].startswith("sha256:"):
                raise ContractError("AUDIT_EVIDENCE_DIGEST_INVALID")
            if item["evidence_id"] in seen:
                raise ContractError("AUDIT_EVIDENCE_DUPLICATE")
            seen.add(item["evidence_id"])
            if isinstance(item.get("captured_at"), bool) or not isinstance(item.get("captured_at"), int) or item["captured_at"] <= 0:
                raise ContractError("AUDIT_EVIDENCE_TIME_INVALID")
        query_ids = event["reconciliation_query_ids"]
        if not isinstance(query_ids, list) or not query_ids or any(not isinstance(x, str) or not x for x in query_ids):
            raise ContractError("AUDIT_RECONCILIATION_REFERENCE_MISSING")
        if event["receipt_verification"] not in ("VERIFIED", "NOT_AVAILABLE", "CONFLICTING", "NOT_REQUIRED"):
            raise ContractError("AUDIT_RECEIPT_STATUS_INVALID")
        if event["disposition"] == "CLOSED_SUCCEEDED":
            if event["outcome_certainty"] != "CONFIRMED" or event["receipt_verification"] != "VERIFIED":
                raise ContractError("AUDIT_TERMINAL_SUCCESS_UNPROVEN")
        elif event["disposition"] == "CLOSED_FAILED":
            if event["outcome_certainty"] != "CONFIRMED" or event["receipt_verification"] != "VERIFIED":
                raise ContractError("AUDIT_TERMINAL_FAILURE_UNPROVEN")
        elif event["disposition"] == "CLOSED_UNRESOLVED":
            if event["outcome_certainty"] != "UNKNOWN":
                raise ContractError("AUDIT_UNRESOLVED_CERTAINTY_INVALID")
        elif event["disposition"] not in ("OPEN", "RETURNED_TO_RECONCILIATION", "ESCALATED"):
            raise ContractError("AUDIT_DISPOSITION_INVALID")


def sample_event() -> dict[str, Any]:
    return {
        "event_id": "audit-1", "case_id": "case-1", "operation_id": "op-1",
        "tenant_id": "tenant-a", "request_fingerprint": "sha256:request",
        "event_type": "RECOVERY_RESOLVED", "occurred_at": 200, "sequence": 1,
        "previous_event_hash": "GENESIS",
        "initiator": {"principal_id": "human-1", "session_id": "session-1", "actor_type": "HUMAN"},
        "operator_id": "operator-1", "approver_id": "approver-2",
        "reason": "STALE_OPERATION", "requested_action": "CLOSE_AS_UNRESOLVED",
        "approval_decision_id": "decision-9", "policy_version": "policy-v3",
        "evidence": [{
            "evidence_id": "evidence-1", "tenant_id": "tenant-a",
            "operation_id": "op-1", "source": "reconciliation-service",
            "captured_at": 190, "content_digest": "sha256:content",
        }],
        "reconciliation_query_ids": ["query-4"],
        "receipt_verification": "NOT_AVAILABLE",
        "execution_attempt_id": "attempt-1",
        "disposition": "CLOSED_UNRESOLVED", "outcome_certainty": "UNKNOWN",
    }


class RecoveryAuditTests(unittest.TestCase):
    def setUp(self):
        self.verify_checkpoint = lambda checkpoint: checkpoint.get("signature_valid") is True
        self.ledger = RecoveryAuditLedger(self.verify_checkpoint)

    def append_event(self, event: dict[str, Any] | None = None, *, signature_valid: bool = True) -> str:
        candidate = copy.deepcopy(event if event is not None else sample_event())
        checkpoint = {
            "sequence": candidate["sequence"],
            "event_hash": digest(canonical(candidate)),
            "signature_valid": signature_valid,
        }
        return self.ledger.append(candidate, checkpoint)

    def test_accepts_scoped_unresolved_recovery_record(self):
        self.append_event()
        self.assertTrue(self.ledger.verify())

    def test_requires_authenticated_initiating_principal_and_session(self):
        event = sample_event()
        event["initiator"] = {"principal_id": "human-1", "actor_type": "HUMAN"}
        with self.assertRaisesRegex(ContractError, "AUDIT_INITIATOR_UNAUTHENTICATED"):
            self.append_event(event)

    def test_rejects_operator_and_approver_identity_collision(self):
        event = sample_event()
        event["approver_id"] = event["operator_id"]
        with self.assertRaisesRegex(ContractError, "AUDIT_OPERATOR_SELF_APPROVAL"):
            self.append_event(event)

    def test_rejects_cross_tenant_evidence_reference(self):
        event = sample_event()
        event["evidence"][0]["tenant_id"] = "tenant-b"
        with self.assertRaisesRegex(ContractError, "AUDIT_EVIDENCE_SCOPE_MISMATCH"):
            self.append_event(event)

    def test_rejects_cross_operation_evidence_reference(self):
        event = sample_event()
        event["evidence"][0]["operation_id"] = "op-other"
        with self.assertRaisesRegex(ContractError, "AUDIT_EVIDENCE_SCOPE_MISMATCH"):
            self.append_event(event)

    def test_requires_evidence_digest(self):
        event = sample_event()
        event["evidence"][0]["content_digest"] = ""
        with self.assertRaisesRegex(ContractError, "AUDIT_EVIDENCE_DIGEST_MISSING"):
            self.append_event(event)

    def test_rejects_unverified_checkpoint(self):
        with self.assertRaisesRegex(ContractError, "CHECKPOINT_UNVERIFIED"):
            self.append_event(signature_valid=False)

    def test_rejects_checkpoint_for_different_event(self):
        event = sample_event()
        checkpoint = {"sequence": 1, "event_hash": "sha256:wrong", "signature_valid": True}
        with self.assertRaisesRegex(ContractError, "CHECKPOINT_EVENT_HASH_MISMATCH"):
            self.ledger.append(event, checkpoint)

    def test_rejects_sequence_gap(self):
        event = sample_event()
        event["sequence"] = 2
        with self.assertRaisesRegex(ContractError, "AUDIT_SEQUENCE_INVALID"):
            self.append_event(event)

    def test_rejects_non_monotonic_event_time(self):
        self.append_event()
        second = sample_event()
        second.update(event_id="audit-2", sequence=2, occurred_at=199,
                      previous_event_hash=self.ledger.records[-1]["event_hash"])
        with self.assertRaisesRegex(ContractError, "AUDIT_TIME_NOT_MONOTONIC"):
            self.append_event(second)

    def test_rejects_terminal_success_without_verified_receipt(self):
        event = sample_event()
        event.update(disposition="CLOSED_SUCCEEDED", outcome_certainty="CONFIRMED")
        with self.assertRaisesRegex(ContractError, "AUDIT_TERMINAL_SUCCESS_UNPROVEN"):
            self.append_event(event)

    def test_rejects_terminal_failure_without_verified_receipt(self):
        event = sample_event()
        event.update(disposition="CLOSED_FAILED", outcome_certainty="CONFIRMED")
        with self.assertRaisesRegex(ContractError, "AUDIT_TERMINAL_FAILURE_UNPROVEN"):
            self.append_event(event)

    def test_rejects_unresolved_case_claiming_known_outcome(self):
        event = sample_event()
        event["outcome_certainty"] = "CONFIRMED"
        with self.assertRaisesRegex(ContractError, "AUDIT_UNRESOLVED_CERTAINTY_INVALID"):
            self.append_event(event)

    def test_binds_second_event_to_previous_event_hash(self):
        first_hash = self.append_event()
        second = sample_event()
        second.update(event_id="audit-2", sequence=2, occurred_at=210,
                      previous_event_hash=first_hash)
        checkpoint = {"sequence": 2, "event_hash": digest(canonical(second)), "signature_valid": True}
        self.ledger.append(second, checkpoint)
        self.assertTrue(self.ledger.verify())

    def test_rejects_mutated_event_during_verification(self):
        self.append_event()
        self.ledger._records[0]["reason"] = "ALTERED_AFTER_APPEND"
        with self.assertRaisesRegex(ContractError, "AUDIT_EVENT_MUTATED"):
            self.ledger.verify()

    def test_rejects_deleted_or_reordered_record(self):
        self.append_event()
        self.append_event(dict(sample_event(), event_id="audit-2", sequence=2,
                               occurred_at=210, previous_event_hash=self.ledger.records[-1]["event_hash"]))
        self.ledger._records.reverse()
        with self.assertRaises(ContractError):
            self.ledger.verify()

    def test_rejects_missing_reconciliation_query_correlation(self):
        event = sample_event()
        event["reconciliation_query_ids"] = []
        with self.assertRaisesRegex(ContractError, "AUDIT_RECONCILIATION_REFERENCE_MISSING"):
            self.append_event(event)

    def test_evidence_content_is_referenced_by_digest_not_embedded(self):
        event = sample_event()
        self.assertNotIn("content", event["evidence"][0])
        self.append_event(event)
        self.assertTrue(self.ledger.verify())


if __name__ == "__main__":
    unittest.main(verbosity=2)
