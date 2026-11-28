"""Tests for tamper-evident local supplier evidence ledger."""
from __future__ import annotations

import copy
import json
import sys
import tempfile
import unittest
from pathlib import Path

VALIDATE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VALIDATE_DIR))

from supplier_evidence_ledger import append_event, event_digest, verify_ledger  # noqa: E402
from validate import load_json  # noqa: E402


class SupplierEvidenceLedgerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = load_json(VALIDATE_DIR / "schemas/supplier-evidence-event.schema.json")
        cls.fixture = load_json(VALIDATE_DIR / "fixtures/supplier-evidence/synthetic-pending-event.json")

    def make_event(self, event_id="synthetic-event-0001"):
        event = copy.deepcopy(self.fixture)
        event["eventId"] = event_id
        event.pop("sequence")
        event.pop("previousEventHash")
        event.pop("eventHash")
        return event

    def test_pending_supplier_assertion_is_valid(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "evidence.jsonl"
            result = append_event(path, self.make_event(), self.schema)
            self.assertTrue(result["appended"])
            ledger = json.loads(path.read_text(encoding="utf-8").splitlines()[0])
            self.assertEqual(ledger["evidenceStatus"], "pending")
            self.assertEqual(ledger["verificationMethod"], "supplier-assertion")
            self.assertTrue(verify_ledger([ledger], self.schema)["valid"])

    def test_independently_verified_evidence_requires_reviewer_and_digest(self):
        event = self.make_event()
        event.update({
            "evidenceStatus": "verified",
            "verificationMethod": "independent-confirmation",
            "reviewer": "reviewer-01",
            "sourceSha256": "a" * 64
        })
        event["sequence"] = 1
        event["previousEventHash"] = None
        event["eventHash"] = event_digest(event)
        from supplier_evidence_ledger import validate_event
        self.assertEqual(validate_event(event, self.schema), [])

    def test_supplier_assertion_cannot_be_marked_verified(self):
        event = self.make_event()
        event.update({
            "evidenceStatus": "verified",
            "verificationMethod": "supplier-assertion",
            "reviewer": "reviewer-01",
            "sourceSha256": "a" * 64
        })
        event["sequence"] = 1
        event["previousEventHash"] = None
        event["eventHash"] = event_digest(event)
        from supplier_evidence_ledger import validate_event
        self.assertTrue(validate_event(event, self.schema))

    def test_hash_chain_detects_tampering(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "evidence.jsonl"
            append_event(path, self.make_event(), self.schema)
            event = self.make_event("synthetic-event-0002")
            event["recordedAt"] = "2026-11-26T00:01:00Z"
            append_event(path, event, self.schema)
            events = [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]
            events[0]["claimValue"] = "tampered"
            result = verify_ledger(events, self.schema)
            self.assertFalse(result["valid"])
            self.assertTrue(any("eventHash mismatch" in item for item in result["errors"]))

    def test_sequence_or_predecessor_change_is_detected(self):
        event = self.make_event()
        event["sequence"] = 2
        event["previousEventHash"] = "b" * 64
        event["eventHash"] = event_digest(event)
        result = verify_ledger([event], self.schema)
        self.assertFalse(result["valid"])
        self.assertTrue(any("sequence must be 1" in item for item in result["errors"]))
        self.assertTrue(any("previousEventHash" in item for item in result["errors"]))

    def test_duplicate_event_ids_are_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "evidence.jsonl"
            append_event(path, self.make_event(), self.schema)
            with self.assertRaisesRegex(ValueError, "duplicate eventId"):
                append_event(path, self.make_event(), self.schema)

    def test_refuses_to_extend_tampered_ledger(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "evidence.jsonl"
            append_event(path, self.make_event(), self.schema)
            path.write_text(path.read_text(encoding="utf-8").replace("not independently", "altered wording"), encoding="utf-8")
            with self.assertRaisesRegex(ValueError, "invalid ledger"):
                append_event(path, self.make_event("synthetic-event-0002"), self.schema)

    def test_blank_lines_are_not_silently_ignored(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "evidence.jsonl"
            path.write_text("\n", encoding="utf-8")
            from supplier_evidence_ledger import read_ledger
            with self.assertRaisesRegex(ValueError, "blank ledger line"):
                read_ledger(path)


if __name__ == "__main__":
    unittest.main()
