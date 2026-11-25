"""Tests for provider registry and gated execution-environment coordination."""
import unittest

from execution_environment_provisioning import ProvisioningApproval, ProvisioningPolicyError
from execution_environment_provider import (
    ExecutionEnvironmentProviderRegistry,
    ExecutionEnvironmentProvisioningCoordinator,
)

NOW = "2026-11-25T19:00:00+00:00"


class FakeProvider:
    provider_id = "test-provider"

    def __init__(self, cost="120.00"):
        self.cost = cost
        self.provision_calls = 0
        self.quarantined = []

    def capabilities(self):
        return {
            "provider": self.provider_id, "account_ref": "test-account-ref",
            "region": "test-region-1", "resource_class": "container-small",
            "currency": "ZAR", "estimated_recurring_cost": "120.00",
            "capabilities": ["container-runtime", "network-egress"],
        }

    def provision(self, authorization):
        self.provision_calls += 1
        assert authorization["authorization_status"] == "validated_not_executed"
        return {
            "resource_id": "resource-test-001", "provider_id": self.provider_id,
            "region": "test-region-1", "resource_class": "container-small",
            "environment": "development", "currency": "ZAR", "recurring_cost": self.cost,
            "idempotency_key": "idem-test-001",
        }

    def inspect(self, resource_id):
        return {"resource_id": resource_id, "status": "running"}

    def attest(self, resource_id):
        return {"resource_id": resource_id, "attested": True}

    def quarantine(self, resource_id, reason):
        self.quarantined.append((resource_id, reason))

    def drain(self, resource_id):
        return {"resource_id": resource_id, "status": "draining"}

    def release(self, resource_id, authorization):
        return {"resource_id": resource_id, "status": "released"}


def request():
    return {
        "request_id": "req-test-001", "idempotency_key": "idem-test-001",
        "environment": "development", "provider": "test-provider", "region": "test-region-1",
        "resource_class": "container-small", "currency": "ZAR", "maximum_cost": "200.00",
    }


def approval(plan):
    return ProvisioningApproval(
        approval_id="approval-test-001", actor_id="owner-test-001", plan_id=plan.plan_id,
        plan_digest=plan.plan_digest, environment=plan.environment, currency=plan.currency,
        maximum_cost="200.00", approved_at="2026-11-25T19:01:00+00:00",
        expires_at="2026-11-25T19:20:00+00:00", fortress_authorization_ref="fortress-test-001",
    )


class ProviderCoordinatorTests(unittest.TestCase):
    def test_registry_never_selects_an_implicit_provider(self):
        registry = ExecutionEnvironmentProviderRegistry()
        self.assertEqual(registry.provider_ids(), ())
        with self.assertRaisesRegex(ProvisioningPolicyError, "EXPLICIT_PROVIDER_REQUIRED"):
            ExecutionEnvironmentProvisioningCoordinator(registry, lambda *_: True).plan(
                {k: v for k, v in request().items() if k != "provider"}, now=NOW
            )

    def test_no_provider_adapter_means_no_plan(self):
        registry = ExecutionEnvironmentProviderRegistry()
        with self.assertRaisesRegex(ProvisioningPolicyError, "PROVIDER_ADAPTER_UNAVAILABLE"):
            ExecutionEnvironmentProvisioningCoordinator(registry, lambda *_: True).plan(request(), now=NOW)

    def test_fortress_denial_prevents_provider_call(self):
        provider = FakeProvider()
        coordinator = ExecutionEnvironmentProvisioningCoordinator(
            ExecutionEnvironmentProviderRegistry({"test-provider": provider}), lambda *_: False
        )
        plan = coordinator.plan(request(), now=NOW)
        with self.assertRaisesRegex(ProvisioningPolicyError, "FORTRESS_AUTHORIZATION_DENIED"):
            coordinator.provision(plan, approval(plan), now="2026-11-25T19:02:00+00:00")
        self.assertEqual(provider.provision_calls, 0)

    def test_approved_provision_remains_pending_attestation(self):
        provider = FakeProvider()
        coordinator = ExecutionEnvironmentProvisioningCoordinator(
            ExecutionEnvironmentProviderRegistry({"test-provider": provider}), lambda *_: True
        )
        plan = coordinator.plan(request(), now=NOW)
        result = coordinator.provision(plan, approval(plan), now="2026-11-25T19:02:00+00:00")
        self.assertEqual(provider.provision_calls, 1)
        self.assertEqual(result["logical_node_identity"], "software-runtime")
        self.assertTrue(result["runtime_host_is_separate"])
        self.assertFalse(result["promotion_eligible"])
        self.assertEqual(result["status"], "PROVISIONED_PENDING_ATTESTATION")

    def test_provider_cost_overrun_quarantines_resource(self):
        provider = FakeProvider(cost="201.00")
        coordinator = ExecutionEnvironmentProvisioningCoordinator(
            ExecutionEnvironmentProviderRegistry({"test-provider": provider}), lambda *_: True
        )
        plan = coordinator.plan(request(), now=NOW)
        with self.assertRaisesRegex(ProvisioningPolicyError, "PROVIDER_COST_EXCEEDS_APPROVED_CEILING"):
            coordinator.provision(plan, approval(plan), now="2026-11-25T19:02:00+00:00")
        self.assertEqual(provider.quarantined[0][0], "resource-test-001")


if __name__ == "__main__":
    unittest.main(verbosity=2)
