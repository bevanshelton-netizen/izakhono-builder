import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
SCHEMA = ROOT / "schemas" / "security" / "fortress-entity-access-context-v1.schema.json"
FIXTURES = ROOT / "tests" / "fixtures" / "fortress-entity-isolation-conformance-v1.json"
SPEC = ROOT / "docs" / "security" / "IZAKHONO-FORTRESS-ENTITY-ISOLATION-AND-TRUST-BOUNDARY-V1.md"


class EntityIsolationContractIntegrityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads(SCHEMA.read_text(encoding="utf-8"))
        cls.suite = json.loads(FIXTURES.read_text(encoding="utf-8"))

    def test_schema_is_strict_object_contract(self):
        self.assertEqual(self.schema["type"], "object")
        self.assertIs(self.schema["additionalProperties"], False)
        self.assertEqual(self.schema["properties"]["contract_version"]["const"], "1.0")

    def test_schema_requires_trusted_context_and_resource_scope(self):
        required = set(self.schema["required"])
        self.assertTrue({
            "trusted_principal", "tenant_context", "resource",
            "action", "purpose", "environment", "correlation_id",
        }.issubset(required))

    def test_principal_actor_vocabulary_is_closed(self):
        actor = self.schema["properties"]["trusted_principal"]["properties"]["actor_type"]["enum"]
        self.assertEqual(set(actor), {"user", "service", "agent", "system"})

    def test_tenant_context_requires_both_tenant_and_entity(self):
        tenant = self.schema["properties"]["tenant_context"]
        self.assertEqual(set(tenant["required"]), {"tenant_id", "entity_id"})
        self.assertIs(tenant["additionalProperties"], False)

    def test_resource_context_requires_owner_domain(self):
        resource = self.schema["properties"]["resource"]
        self.assertTrue({"resource_type", "resource_id", "owner_domain"}.issubset(set(resource["required"])))

    def test_fixture_ids_are_unique_and_well_formed(self):
        cases = self.suite["cases"]
        ids = [case[0] for case in cases]
        self.assertEqual(len(ids), len(set(ids)))
        for case in cases:
            self.assertEqual(len(case), 7)
            self.assertRegex(case[0], r"^EI-[0-9]{3}$")
            self.assertIn(case[2], {"allow", "deny"})

    def test_default_deny_scenarios_are_present(self):
        cases = {case[0]: case for case in self.suite["cases"]}
        for fixture_id in (
            "EI-003", "EI-005", "EI-007", "EI-008", "EI-009",
            "EI-013", "EI-014", "EI-018", "EI-020", "EI-023",
            "EI-024", "EI-025", "EI-026", "EI-027", "EI-028", "EI-029",
        ):
            self.assertEqual(cases[fixture_id][2], "deny", fixture_id)

    def test_cross_tenant_allow_is_explicit_exception_only(self):
        cases = {case[0]: case for case in self.suite["cases"]}
        self.assertEqual(cases["EI-030"][2], "allow")
        self.assertIn("explicit", self.suite["assertions"][1])
        self.assertIn("independently approved", self.suite["assertions"][1])

    def test_spec_disclaims_implementation_and_requires_enforcement_evidence(self):
        spec = SPEC.read_text(encoding="utf-8")
        self.assertIn("not a deployed identity or tenant-isolation service", spec)
        self.assertIn("caller-provided tenant or entity identifier is a resource selector, never proof of authority", spec)
        self.assertIn("Do not certify tenant isolation from unit tests of a pure policy function alone", spec)


if __name__ == "__main__":
    unittest.main()
