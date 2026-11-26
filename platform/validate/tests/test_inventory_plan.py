"""Tests for deterministic, non-executing inventory placement plans."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

VALIDATE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VALIDATE_DIR))

from inventory_plan import build_plan, canonical_json, cpu_cores, memory_gib, service_demand, storage_gib  # noqa: E402
from validate import load_json  # noqa: E402


class ReadOnlyInventoryPlanTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service = load_json(VALIDATE_DIR / "fixtures/services/caddy-staging.json")
        cls.unselected = load_json(VALIDATE_DIR / "fixtures/hosts/unverified-no-host-selected.json")

    def approved_host(self):
        host = copy.deepcopy(self.unselected)
        host.update({
            "hostId": "host-test-staging-001",
            "provider": "synthetic-test-provider",
            "productSku": "synthetic-capacity",
            "region": "test-region",
            "approvalState": "approved",
            "executionResourceId": "synthetic-resource-001",
            "hostType": "vps",
            "evidenceReferences": ["test:evidence/host-001"],
            "approvalReference": "TEST-APPROVAL-001",
            "roles": ["staging-app"],
        })
        host["operatingSystem"] = {
            "name": "Synthetic Linux",
            "version": "1",
            "supportStatus": "supported",
        }
        host["capacity"] = {"vcpus": 2, "memoryGiB": 4, "storageGiB": 50}
        return host

    def test_quantity_conversions(self):
        self.assertEqual(cpu_cores("500m"), 0.5)
        self.assertEqual(cpu_cores("2"), 2)
        self.assertEqual(memory_gib("512Mi"), 0.5)
        self.assertEqual(memory_gib("2Gi"), 2)
        self.assertEqual(storage_gib("1Ti"), 1024)

    def test_service_demand_includes_replica_multiplication_and_persistent_only(self):
        candidate = copy.deepcopy(self.service)
        candidate["spec"]["runtime"]["replicas"] = 2
        candidate["spec"]["storage"]["mounts"] = [
            {"name": "data", "mountPath": "/data", "size": "10Gi", "persistent": True},
            {"name": "scratch", "mountPath": "/scratch", "size": "5Gi", "persistent": False},
        ]
        self.assertEqual(service_demand(candidate), {
            "replicas": 2,
            "cpuCores": 1.0,
            "memoryGiB": 1.0,
            "persistentStorageGiB": 10.0,
        })

    def test_unverified_fixture_never_becomes_a_candidate(self):
        plan = build_plan(self.service, [self.unselected], "staging", "staging-app")
        self.assertEqual(plan["status"], "BLOCKED_NO_ELIGIBLE_HOST")
        self.assertIsNone(plan["selectedHost"])
        self.assertFalse(plan["executionPermitted"])
        self.assertFalse(plan["deploymentPerformed"])
        self.assertEqual(plan["actions"], [])

    def test_approved_host_is_selected_and_plan_is_deterministic(self):
        host = self.approved_host()
        first = build_plan(self.service, [host], "staging", "staging-app")
        second = build_plan(self.service, [host], "staging", "staging-app")
        self.assertEqual(first, second)
        self.assertEqual(first["status"], "PLAN_READY")
        self.assertEqual(first["selectedHost"]["hostId"], host["hostId"])
        self.assertEqual(first["actions"], [])
        self.assertEqual(len(first["planSha256"]), 64)

    def test_capacity_shortfall_blocks_candidate(self):
        host = self.approved_host()
        host["capacity"]["memoryGiB"] = 0.25
        plan = build_plan(self.service, [host], "staging", "staging-app")
        self.assertEqual(plan["status"], "BLOCKED_NO_ELIGIBLE_HOST")
        self.assertTrue(any("memoryGiB is insufficient" in reason for reason in plan["rejectedHosts"][0]["reasons"]))

    def test_wrong_environment_and_role_are_rejected(self):
        host = self.approved_host()
        plan = build_plan(self.service, [host], "production", "production-app")
        reasons = plan["rejectedHosts"][0]["reasons"]
        self.assertTrue(any("environment" in reason for reason in reasons))
        self.assertTrue(any("role" in reason for reason in reasons))

    def test_host_order_does_not_change_selection_or_hash(self):
        host_a = self.approved_host()
        host_b = copy.deepcopy(host_a)
        host_b["hostId"] = "host-test-staging-002"
        host_b["executionResourceId"] = "synthetic-resource-002"
        forward = build_plan(self.service, [host_a, host_b], "staging", "staging-app")
        reverse = build_plan(self.service, [host_b, host_a], "staging", "staging-app")
        self.assertEqual(forward, reverse)
        self.assertEqual(forward["selectedHost"]["hostId"], "host-test-staging-001")

    def test_canonical_json_is_key_order_independent(self):
        self.assertEqual(canonical_json({"b": 2, "a": 1}), canonical_json({"a": 1, "b": 2}))


if __name__ == "__main__":
    unittest.main()
