import copy
import json
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

from izakhono_edge_activation import (
    load_contract,
    validate_dns_placement,
    validate_gateway_registration,
)

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = json.loads((ROOT / "workloads" / "izakhono-edge.json").read_text())
NOW = datetime(2026, 11, 26, 12, 0, tzinfo=timezone.utc)


def registration():
    return {
        "status": "active",
        "adapter": "node01-command-gateway",
        "registration_id": "reg-edge-test-001",
        "logical_node_id": "NODE01",
        "observed_at": (NOW - timedelta(seconds=30)).isoformat(),
        "capabilities": ["runtime.deploy", "edge.activate", "runtime.health"],
        "runtime": {
            "execution_environment_id": "host-env-test-01",
            "registered": True,
            "state": "healthy",
        },
        "authorization": {
            "provider": "FORTRESS",
            "decision": "allow",
            "tenant_id": "tenant-test-01",
            "workload": "izakhono-edge",
            "environment": "production",
            "authorization_id": "auth-test-001",
        },
        "audit": {
            "acknowledged": True,
            "event_id": "audit-test-001",
            "authorization_id": "auth-test-001",
        },
    }


class EdgeActivationTests(unittest.TestCase):
    def test_contract_is_valid(self):
        load_contract(CONTRACT)

    def test_rejects_wrong_logical_identity(self):
        bad = copy.deepcopy(CONTRACT)
        bad["identity"]["logical_node_id"] = "host-env-test-01"
        with self.assertRaisesRegex(ValueError, "software identity"):
            load_contract(bad)

    def test_rejects_host_coupled_to_node_identity(self):
        bad = copy.deepcopy(CONTRACT)
        bad["identity"]["runtime_host_is_separate"] = False
        with self.assertRaisesRegex(ValueError, "separate runtime host"):
            load_contract(bad)

    def test_accepts_fresh_scoped_registration(self):
        result = validate_gateway_registration(registration(), CONTRACT, "tenant-test-01", now=NOW)
        self.assertEqual(result["execution_environment_id"], "host-env-test-01")
        self.assertEqual(result["authorization_id"], "auth-test-001")

    def test_rejects_stale_registration(self):
        value = registration()
        value["observed_at"] = (NOW - timedelta(seconds=301)).isoformat()
        with self.assertRaisesRegex(ValueError, "stale"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_rejects_future_registration(self):
        value = registration()
        value["observed_at"] = (NOW + timedelta(minutes=2)).isoformat()
        with self.assertRaisesRegex(ValueError, "future"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_rejects_missing_capability(self):
        value = registration()
        value["capabilities"].remove("edge.activate")
        with self.assertRaisesRegex(ValueError, "capabilities"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_rejects_node_as_execution_host(self):
        value = registration()
        value["runtime"]["execution_environment_id"] = "NODE01"
        with self.assertRaisesRegex(ValueError, "separate execution environment"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_rejects_unhealthy_runtime(self):
        value = registration()
        value["runtime"]["state"] = "unknown"
        with self.assertRaisesRegex(ValueError, "healthy"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_rejects_tenant_mismatch(self):
        with self.assertRaisesRegex(ValueError, "FORTRESS authorization"):
            validate_gateway_registration(registration(), CONTRACT, "another-tenant", now=NOW)

    def test_rejects_denied_fortress_decision(self):
        value = registration()
        value["authorization"]["decision"] = "deny"
        with self.assertRaisesRegex(ValueError, "FORTRESS authorization"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_rejects_unacknowledged_audit(self):
        value = registration()
        value["audit"]["acknowledged"] = False
        with self.assertRaisesRegex(ValueError, "audit acknowledgement"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_rejects_audit_authorization_mismatch(self):
        value = registration()
        value["audit"]["authorization_id"] = "different"
        with self.assertRaisesRegex(ValueError, "audit acknowledgement"):
            validate_gateway_registration(value, CONTRACT, "tenant-test-01", now=NOW)

    def test_accepts_independent_dns_placement(self):
        validate_dns_placement(
            {"execution_environment_id": "env-a", "network_failure_domain_id": "network-a", "healthy": True},
            {"execution_environment_id": "env-b", "network_failure_domain_id": "network-b", "healthy": True},
        )

    def test_rejects_same_dns_execution_environment(self):
        with self.assertRaisesRegex(ValueError, "share one execution environment"):
            validate_dns_placement(
                {"execution_environment_id": "env-a", "network_failure_domain_id": "network-a", "healthy": True},
                {"execution_environment_id": "env-a", "network_failure_domain_id": "network-b", "healthy": True},
            )

    def test_rejects_same_dns_failure_domain(self):
        with self.assertRaisesRegex(ValueError, "share one network failure domain"):
            validate_dns_placement(
                {"execution_environment_id": "env-a", "network_failure_domain_id": "network-a", "healthy": True},
                {"execution_environment_id": "env-b", "network_failure_domain_id": "network-a", "healthy": True},
            )

    def test_rejects_unhealthy_dns_secondary(self):
        with self.assertRaisesRegex(ValueError, "not healthy"):
            validate_dns_placement(
                {"execution_environment_id": "env-a", "network_failure_domain_id": "network-a", "healthy": True},
                {"execution_environment_id": "env-b", "network_failure_domain_id": "network-b", "healthy": False},
            )


if __name__ == "__main__":
    unittest.main()
