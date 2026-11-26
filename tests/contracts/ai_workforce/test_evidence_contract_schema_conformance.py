"""Structural checks for the proposed evidence JSON Schema contract."""
import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[3]
SCHEMA_PATH = ROOT / "schemas" / "ai-workforce" / "evidence-contracts-v1.schema.json"


def resolve_pointer(document, pointer):
    current = document
    for token in pointer.removeprefix("#/").split("/"):
        token = token.replace("~1", "/").replace("~0", "~")
        current = current[token]
    return current


class EvidenceContractSchemaTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
        cls.defs = cls.schema["$defs"]

    def test_schema_is_valid_json_schema_document_shape(self):
        self.assertEqual(self.schema["$schema"],
                         "https://json-schema.org/draft/2020-12/schema")
        self.assertIn("$defs", self.schema)

    def test_all_internal_references_resolve(self):
        refs = []

        def walk(value):
            if isinstance(value, dict):
                if "$ref" in value and value["$ref"].startswith("#/"):
                    refs.append(value["$ref"])
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)

        walk(self.schema)
        for ref in refs:
            with self.subTest(ref=ref):
                self.assertIsNotNone(resolve_pointer(self.schema, ref))

    def test_resolve_request_requires_exact_object_version(self):
        required = set(self.defs["resolveRequest"]["required"])
        self.assertIn("evidence_object_id", required)
        self.assertIn("object_version_id", required)
        self.assertNotIn("latest", self.defs["resolveRequest"]["properties"])
        self.assertNotIn("storage_locator", self.defs["resolveRequest"]["properties"])

    def test_resolve_request_binds_action_to_read(self):
        self.assertEqual(self.defs["resolveRequest"]["properties"]["action"]["const"],
                         "READ")

    def test_operation_and_fingerprint_are_paired(self):
        dependencies = self.defs["resolveRequest"]["dependentRequired"]
        self.assertIn("request_fingerprint", dependencies["operation_id"])
        self.assertIn("operation_id", dependencies["request_fingerprint"])

    def test_resolve_request_rejects_undeclared_properties(self):
        self.assertFalse(self.defs["resolveRequest"]["additionalProperties"])

    def test_response_requires_digest_and_audit_reference(self):
        required = set(self.defs["resolveResponse"]["required"])
        self.assertIn("content_digest", required)
        self.assertIn("audit_reference", required)
        self.assertIn("object_version_id", required)

    def test_manifest_requires_canonicalization_and_tenant_binding(self):
        required = set(self.defs["manifest"]["required"])
        self.assertIn("canonicalization_profile_ref", required)
        self.assertIn("tenant_id", required)
        self.assertIn("operation_id", required)
        self.assertIn("manifest_digest", required)

    def test_evidence_reference_binds_tenant_version_and_digest(self):
        required = set(self.defs["evidenceReference"]["required"])
        self.assertTrue({"tenant_id", "evidence_object_id",
                         "object_version_id", "content_digest"}.issubset(required))

    def test_digest_profile_is_explicit_and_algorithm_is_not_hardcoded(self):
        digest = self.defs["digest"]
        self.assertIn("algorithm", digest["required"])
        self.assertIn("profile_ref", digest["required"])
        self.assertNotIn("const", digest["properties"]["algorithm"])
        self.assertNotIn("enum", digest["properties"]["algorithm"])


if __name__ == "__main__":
    unittest.main()
