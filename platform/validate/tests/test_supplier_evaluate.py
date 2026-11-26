"""Fail-closed supplier hard-gate and weighted comparison tests."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

VALIDATE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VALIDATE_DIR))

from supplier_evaluate import compare_records, score_record  # noqa: E402
from validate import load_json  # noqa: E402


class SupplierEvaluationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = load_json(VALIDATE_DIR / "schemas/supplier-evaluation.schema.json")
        cls.fixture = load_json(VALIDATE_DIR / "fixtures/suppliers/synthetic-eligible-example.json")

    def test_fully_verified_record_is_scored_with_declared_weights(self):
        result = score_record(self.fixture)
        self.assertEqual(result["status"], "SCORED")
        self.assertEqual(result["weightedTotal"], 86.0)
        self.assertEqual(result["decision"], "preferred-pilot-candidate")
        self.assertFalse(result["purchasePermitted"])

    def test_unknown_mandatory_gate_blocks_even_perfect_score(self):
        candidate = copy.deepcopy(self.fixture)
        candidate["hardGates"]["capacity"]["status"] = "unknown"
        result = score_record(candidate)
        self.assertEqual(result["status"], "BLOCKED_HARD_GATES")
        self.assertIsNone(result["weightedTotal"])
        self.assertEqual(result["decision"], "not-eligible")

    def test_supplier_claim_does_not_pass_a_hard_gate(self):
        candidate = copy.deepcopy(self.fixture)
        candidate["hardGates"]["security"]["evidenceStatus"] = "supplier-claimed"
        result = score_record(candidate)
        self.assertIn("security: passing claim is not independently verified (supplier-claimed)", result["hardGates"]["blockers"])

    def test_mail_role_requires_all_mail_specific_gates(self):
        candidate = copy.deepcopy(self.fixture)
        candidate["role"] = "mail"
        result = score_record(candidate)
        self.assertEqual(result["status"], "BLOCKED_HARD_GATES")
        self.assertTrue(any("mail_policy" in item for item in result["hardGates"]["blockers"]))

    def test_dns_and_backup_roles_have_role_specific_gates(self):
        dns = copy.deepcopy(self.fixture)
        dns["role"] = "dns-secondary"
        backup = copy.deepcopy(self.fixture)
        backup["role"] = "backup"
        self.assertTrue(any("authenticated_axfr_ixfr" in item for item in score_record(dns)["hardGates"]["blockers"]))
        self.assertTrue(any("restore_test" in item for item in score_record(backup)["hardGates"]["blockers"]))

    def test_missing_weighted_evidence_prevents_ranking(self):
        candidate = copy.deepcopy(self.fixture)
        candidate["weightedScores"]["technicalFit"]["evidenceStatus"] = "supplier-claimed"
        result = score_record(candidate)
        self.assertEqual(result["status"], "INCOMPLETE_WEIGHTED_EVIDENCE")
        self.assertIsNone(result["weightedTotal"])

    def test_commercial_price_does_not_override_gates_or_grant_purchase(self):
        candidate = copy.deepcopy(self.fixture)
        candidate["commercial"]["recurringMonthly"] = 1
        candidate["hardGates"]["mail_policy"]["status"] = "fail"
        candidate["role"] = "mail"
        result = score_record(candidate)
        self.assertEqual(result["status"], "BLOCKED_HARD_GATES")
        self.assertFalse(result["purchasePermitted"])

    def test_comparison_ranks_only_complete_eligible_records_and_is_deterministic(self):
        low = copy.deepcopy(self.fixture)
        low["supplierId"] = "synthetic-lower-score"
        low["weightedScores"]["technicalFit"]["value"] = 2
        forward = compare_records([low, self.fixture], self.schema)
        reverse = compare_records([self.fixture, low], self.schema)
        self.assertEqual(forward, reverse)
        self.assertEqual(forward["evaluations"][0]["supplierId"], self.fixture["supplierId"])
        self.assertFalse(forward["supplierSelectionMade"])
        self.assertFalse(forward["purchaseAuthorizationGranted"])

    def test_invalid_record_is_reported_not_silently_scored(self):
        invalid = copy.deepcopy(self.fixture)
        del invalid["commercial"]["currency"]
        result = compare_records([invalid], self.schema)
        self.assertEqual(len(result["invalidRecords"]), 1)
        self.assertEqual(result["evaluations"], [])


if __name__ == "__main__":
    unittest.main()
