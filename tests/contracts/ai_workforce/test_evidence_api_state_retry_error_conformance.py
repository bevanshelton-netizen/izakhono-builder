"""Synthetic state, retry and error-contract conformance tests.

No persistence engine, broker, network or production authorization is used.
"""
import hashlib
import unittest


def fingerprint(payload):
    canonical = "|".join(f"{k}={payload[k]}" for k in sorted(payload))
    return hashlib.sha256(canonical.encode()).hexdigest()


class IdempotencyModel:
    def __init__(self):
        self.records = {}

    def submit(self, tenant, family, key, payload):
        if not key:
            return {"state": "REJECTED", "error": "IDEMPOTENCY_KEY_REQUIRED"}
        fp = fingerprint(payload)
        identity = (tenant, family, key)
        prior = self.records.get(identity)
        if prior:
            if prior["fingerprint"] != fp:
                return {"state": "REJECTED", "error": "IDEMPOTENCY_CONFLICT"}
            return dict(prior)
        record = {"state": "RECEIVED", "fingerprint": fp, "operation_id": f"op-{len(self.records) + 1}"}
        self.records[identity] = record
        return dict(record)


class IngestLifecycle:
    ALLOWED = {
        "RECEIVED": {"VALIDATING", "REJECTED"},
        "VALIDATING": {"STAGING", "REJECTED"},
        "STAGING": {"VERIFYING", "QUARANTINED", "UNKNOWN"},
        "VERIFYING": {"STAGED_VERIFIED", "QUARANTINED", "REJECTED"},
        "STAGED_VERIFIED": {"COMMIT_PENDING", "QUARANTINED"},
        "COMMIT_PENDING": {"COMMITTED", "UNKNOWN", "QUARANTINED"},
        "UNKNOWN": {"COMMITTED", "FAILED_SAFE", "QUARANTINED"},
        "QUARANTINED": {"UNKNOWN", "FAILED_SAFE"},
        "COMMITTED": set(),
        "REJECTED": set(),
        "FAILED_SAFE": set(),
    }

    def __init__(self):
        self.state = "RECEIVED"
        self.history = [self.state]

    def transition(self, target):
        if target not in self.ALLOWED[self.state]:
            return False
        self.state = target
        self.history.append(target)
        return True


class ErrorEnvelope:
    ALLOWED_RETRY = {
        "NEVER", "AFTER_REAUTHORIZATION", "AFTER_POLICY_CHANGE",
        "SAFE_SAME_KEY", "RECONCILE_FIRST", "OPERATOR_REVIEW"
    }
    ALLOWED_CERTAINTY = {
        "NO_EFFECT_PROVEN", "EFFECT_NOT_STARTED", "COMMITTED", "UNKNOWN", "PARTIAL"
    }

    @classmethod
    def valid(cls, value):
        required = {"error_code", "request_id", "correlation_id",
                    "retry_class", "outcome_certainty", "message"}
        return (
            required.issubset(value)
            and value["retry_class"] in cls.ALLOWED_RETRY
            and value["outcome_certainty"] in cls.ALLOWED_CERTAINTY
            and not ({"storage_locator", "credential", "access_token",
                      "raw_exception", "sql"} & set(value))
        )


class EvidenceApiStateRetryTests(unittest.TestCase):
    def setUp(self):
        self.ledger = IdempotencyModel()
        self.payload = {"object": "ev-1", "version": "v1", "purpose": "AUDIT"}

    def test_same_key_same_fingerprint_returns_same_operation(self):
        first = self.ledger.submit("tenant-a", "INGEST", "key-1", self.payload)
        second = self.ledger.submit("tenant-a", "INGEST", "key-1", self.payload)
        self.assertEqual(first["operation_id"], second["operation_id"])
        self.assertEqual(len(self.ledger.records), 1)

    def test_same_key_different_fingerprint_conflicts(self):
        self.ledger.submit("tenant-a", "INGEST", "key-1", self.payload)
        changed = dict(self.payload, purpose="EXPORT")
        result = self.ledger.submit("tenant-a", "INGEST", "key-1", changed)
        self.assertEqual(result["error"], "IDEMPOTENCY_CONFLICT")
        self.assertEqual(len(self.ledger.records), 1)

    def test_tenants_have_independent_idempotency_namespaces(self):
        a = self.ledger.submit("tenant-a", "INGEST", "same-key", self.payload)
        b = self.ledger.submit("tenant-b", "INGEST", "same-key", self.payload)
        self.assertNotEqual(a["operation_id"], b["operation_id"])
        self.assertEqual(len(self.ledger.records), 2)

    def test_operation_families_have_independent_namespaces(self):
        a = self.ledger.submit("tenant-a", "INGEST", "same-key", self.payload)
        b = self.ledger.submit("tenant-a", "DISPOSITION", "same-key", self.payload)
        self.assertNotEqual(a["operation_id"], b["operation_id"])

    def test_missing_idempotency_key_rejected(self):
        result = self.ledger.submit("tenant-a", "INGEST", "", self.payload)
        self.assertEqual(result["error"], "IDEMPOTENCY_KEY_REQUIRED")
        self.assertEqual(self.ledger.records, {})

    def test_fingerprint_is_order_independent_for_mapping_keys(self):
        self.assertEqual(fingerprint({"a": "1", "b": "2"}),
                         fingerprint({"b": "2", "a": "1"}))

    def test_ingest_reaches_committed_only_through_required_states(self):
        flow = IngestLifecycle()
        for state in ("VALIDATING", "STAGING", "VERIFYING", "STAGED_VERIFIED",
                      "COMMIT_PENDING", "COMMITTED"):
            self.assertTrue(flow.transition(state))
        self.assertEqual(flow.state, "COMMITTED")

    def test_staged_verified_cannot_jump_directly_to_committed(self):
        flow = IngestLifecycle()
        for state in ("VALIDATING", "STAGING", "VERIFYING", "STAGED_VERIFIED"):
            flow.transition(state)
        self.assertFalse(flow.transition("COMMITTED"))

    def test_received_cannot_jump_to_committed(self):
        flow = IngestLifecycle()
        self.assertFalse(flow.transition("COMMITTED"))

    def test_committed_is_terminal(self):
        flow = IngestLifecycle()
        for state in ("VALIDATING", "STAGING", "VERIFYING", "STAGED_VERIFIED",
                      "COMMIT_PENDING", "COMMITTED"):
            flow.transition(state)
        self.assertFalse(flow.transition("UNKNOWN"))

    def test_commit_timeout_can_be_marked_unknown(self):
        flow = IngestLifecycle()
        for state in ("VALIDATING", "STAGING", "VERIFYING", "STAGED_VERIFIED",
                      "COMMIT_PENDING"):
            flow.transition(state)
        self.assertTrue(flow.transition("UNKNOWN"))

    def test_unknown_requires_reconciliation_before_committed(self):
        flow = IngestLifecycle()
        for state in ("VALIDATING", "STAGING", "VERIFYING", "STAGED_VERIFIED",
                      "COMMIT_PENDING", "UNKNOWN"):
            flow.transition(state)
        self.assertTrue(flow.transition("COMMITTED"))
        self.assertEqual(flow.history[-2:], ["UNKNOWN", "COMMITTED"])

    def test_quarantine_is_not_committed(self):
        flow = IngestLifecycle()
        for state in ("VALIDATING", "STAGING", "QUARANTINED"):
            flow.transition(state)
        self.assertNotEqual(flow.state, "COMMITTED")

    def test_rejected_is_terminal(self):
        flow = IngestLifecycle()
        flow.transition("REJECTED")
        self.assertFalse(flow.transition("STAGING"))

    def test_error_envelope_accepts_safe_retry_contract(self):
        error = {"error_code": "OUTCOME_UNKNOWN", "request_id": "r1",
                 "correlation_id": "c1", "retry_class": "RECONCILE_FIRST",
                 "outcome_certainty": "UNKNOWN", "message": "Reconciliation required"}
        self.assertTrue(ErrorEnvelope.valid(error))

    def test_error_envelope_rejects_secret_or_locator_fields(self):
        error = {"error_code": "INTERNAL_ERROR", "request_id": "r1",
                 "correlation_id": "c1", "retry_class": "NEVER",
                 "outcome_certainty": "NO_EFFECT_PROVEN", "message": "Failed",
                 "storage_locator": "private://bucket/key"}
        self.assertFalse(ErrorEnvelope.valid(error))

    def test_error_envelope_rejects_unknown_retry_class(self):
        error = {"error_code": "OUTCOME_UNKNOWN", "request_id": "r1",
                 "correlation_id": "c1", "retry_class": "RETRY_ANYWAY",
                 "outcome_certainty": "UNKNOWN", "message": "Unknown"}
        self.assertFalse(ErrorEnvelope.valid(error))

    def test_error_envelope_rejects_unknown_certainty(self):
        error = {"error_code": "OUTCOME_UNKNOWN", "request_id": "r1",
                 "correlation_id": "c1", "retry_class": "RECONCILE_FIRST",
                 "outcome_certainty": "PROBABLY_OK", "message": "Unknown"}
        self.assertFalse(ErrorEnvelope.valid(error))


if __name__ == "__main__":
    unittest.main()
