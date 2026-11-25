"""Deterministic tests for execution-environment provisioning policy."""
from dataclasses import replace
import unittest

from execution_environment_provisioning import (
    ProvisioningApproval, ProvisioningPolicyError, approve_plan, create_plan,
    provision_authorization_envelope, transition_state,
)

NOW = "2026-11-25T19:00:00+00:00"
REQUEST = {
    "request_id": "req-node01-dev-001", "idempotency_key": "idem-node01-dev-001",
    "environment": "development", "provider": "provider-example", "region": "eu-west-1",
    "resource_class": "container-small", "currency": "ZAR", "maximum_cost": "250.00",
}
CAPABILITY = {
    "provider": "provider-example", "account_ref": "acct-ref-izakhono", "region": "eu-west-1",
    "resource_class": "container-small", "currency": "ZAR", "estimated_recurring_cost": "120.00",
    "capabilities": ["container-runtime", "network-egress", "ephemeral-storage"],
}


def valid_plan():
    return create_plan(REQUEST, CAPABILITY, now=NOW)


def valid_approval(plan):
    return ProvisioningApproval(
        approval_id="approval-001", actor_id="owner-001", plan_id=plan.plan_id,
        plan_digest=plan.plan_digest, environment=plan.environment, currency=plan.currency,
        maximum_cost="200.00", approved_at="2026-11-25T19:01:00+00:00",
        expires_at="2026-11-25T19:20:00+00:00", fortress_authorization_ref="fortress-authz-001",
    )


class ProvisioningPolicyTests(unittest.TestCase):
    def test_plan_is_deterministic_and_side_effect_free(self):
        self.assertEqual(valid_plan(), valid_plan())

    def test_provider_must_be_explicit_and_match_capability(self):
        request = dict(REQUEST)
        request.pop("provider")
        with self.assertRaises(ProvisioningPolicyError):
            create_plan(request, CAPABILITY, now=NOW)
        with self.assertRaisesRegex(ProvisioningPolicyError, "PROVIDER_SELECTION_MISMATCH"):
            create_plan({**REQUEST, "provider": "other-provider"}, CAPABILITY, now=NOW)

    def test_cost_above_user_ceiling_is_rejected(self):
        with self.assertRaisesRegex(ProvisioningPolicyError, "ESTIMATED_COST_EXCEEDS_USER_CEILING"):
            create_plan({**REQUEST, "maximum_cost": "100.00"}, CAPABILITY, now=NOW)

    def test_secrets_are_rejected_from_request_and_capability(self):
        with self.assertRaisesRegex(ProvisioningPolicyError, "SECRET_FIELD_PROHIBITED"):
            create_plan({**REQUEST, "api_key": "never-allowed"}, CAPABILITY, now=NOW)
        with self.assertRaisesRegex(ProvisioningPolicyError, "SECRET_FIELD_PROHIBITED"):
            create_plan(REQUEST, {**CAPABILITY, "token": "never-allowed"}, now=NOW)

    def test_exact_plan_approval_produces_non_executing_envelope(self):
        plan = valid_plan()
        envelope = provision_authorization_envelope(plan, valid_approval(plan), now="2026-11-25T19:02:00+00:00")
        self.assertEqual(envelope["authorization_status"], "validated_not_executed")
        self.assertFalse(envelope["side_effects_performed"])
        self.assertEqual(envelope["maximum_approved_cost"], "200.00")

    def test_tampered_plan_is_rejected(self):
        plan = valid_plan()
        with self.assertRaisesRegex(ProvisioningPolicyError, "PLAN_INTEGRITY_MISMATCH"):
            approve_plan(replace(plan, region="different-region"), valid_approval(plan), now="2026-11-25T19:02:00+00:00")

    def test_approval_cannot_raise_cost_ceiling(self):
        plan = valid_plan()
        approval = replace(valid_approval(plan), maximum_cost="251.00")
        with self.assertRaisesRegex(ProvisioningPolicyError, "APPROVED_COST_CEILING_INVALID"):
            approve_plan(plan, approval, now="2026-11-25T19:02:00+00:00")

    def test_expired_approval_is_rejected(self):
        plan = valid_plan()
        approval = replace(valid_approval(plan), expires_at="2026-11-25T19:01:30+00:00")
        with self.assertRaisesRegex(ProvisioningPolicyError, "APPROVAL_OR_PLAN_EXPIRED"):
            approve_plan(plan, approval, now="2026-11-25T19:02:00+00:00")

    def test_state_machine_rejects_skipping_attestation(self):
        self.assertEqual(transition_state("PROVISIONED", "ATTESTING"), "ATTESTING")
        with self.assertRaisesRegex(ProvisioningPolicyError, "INVALID_STATE_TRANSITION"):
            transition_state("PROVISIONED", "ELIGIBLE")


if __name__ == "__main__":
    unittest.main(verbosity=2)
