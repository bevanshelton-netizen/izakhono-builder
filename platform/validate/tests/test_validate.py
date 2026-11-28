"""Unit tests for IZAKHONO HOST schema and policy validation."""
from __future__ import annotations

import copy
import json
import sys
import unittest
from pathlib import Path

VALIDATE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(VALIDATE_DIR))

from validate import (  # noqa: E402
    DEFAULT_HOST_SCHEMA,
    DEFAULT_POLICY,
    DEFAULT_SERVICE_SCHEMA,
    host_policy_errors,
    load_json,
    schema_errors,
    service_policy_errors,
)


class HostingValidationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.service_schema = load_json(DEFAULT_SERVICE_SCHEMA)
        cls.host_schema = load_json(DEFAULT_HOST_SCHEMA)
        cls.policy = load_json(DEFAULT_POLICY)
        cls.service = load_json(VALIDATE_DIR / "fixtures/services/caddy-staging.json")
        cls.host = load_json(VALIDATE_DIR / "fixtures/hosts/unverified-no-host-selected.json")

    def test_reference_service_manifest_passes_schema_and_staging_policy(self):
        self.assertEqual(schema_errors(self.service, self.service_schema, "fixture"), [])
        self.assertEqual(service_policy_errors(self.service, self.policy, "staging"), [])

    def test_privileged_service_is_rejected(self):
        candidate = copy.deepcopy(self.service)
        candidate["spec"]["security"]["privileged"] = True
        self.assertTrue(any("security.privileged" in item for item in service_policy_errors(candidate, self.policy, "staging")))

    def test_public_ingress_requires_approval_reference(self):
        candidate = copy.deepcopy(self.service)
        candidate["spec"]["network"]["ingress"][0]["exposure"] = "public-approved"
        self.assertTrue(any("requires approvalReference" in item for item in service_policy_errors(candidate, self.policy, "staging")))

    def test_production_manifest_requires_change_approval(self):
        self.assertTrue(any("changeApprovalReference" in item for item in service_policy_errors(self.service, self.policy, "production")))

    def test_unverified_execution_host_is_valid_but_not_approved(self):
        self.assertEqual(schema_errors(self.host, self.host_schema, "fixture"), [])
        self.assertEqual(host_policy_errors(self.host, self.policy), [])
        self.assertEqual(self.host["approvalState"], "unverified")
        self.assertIsNone(self.host["executionResourceId"])

    def test_approved_execution_host_requires_real_inventory_evidence(self):
        candidate = copy.deepcopy(self.host)
        candidate["approvalState"] = "approved"
        errors = host_policy_errors(candidate, self.policy)
        self.assertTrue(any("executionResourceId" in item for item in errors))
        self.assertTrue(any("supported operating system" in item for item in errors))
        self.assertTrue(any("positive capacity" in item for item in errors))

    def test_unknown_manifest_fields_are_rejected(self):
        candidate = copy.deepcopy(self.service)
        candidate["spec"]["unreviewedOption"] = True
        errors = schema_errors(candidate, self.service_schema, "fixture")
        self.assertTrue(any("Additional properties are not allowed" in item for item in errors))


if __name__ == "__main__":
    unittest.main()
