"""Synthetic conformance tests for the proposed evidence package data contract.

These tests use in-memory fixtures only. They do not implement storage,
cryptography, authorization services, legal retention or production transactions.
"""
import hashlib
import json
import unittest
from dataclasses import dataclass


def canonical_bytes(value):
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


def digest(data):
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True)
class ObjectVersion:
    tenant_id: str
    object_id: str
    version_id: str
    content: bytes
    declared_digest: str
    classification: str = "INTERNAL"
    retention_state: str = "ACTIVE"
    legal_hold: bool = False


class EvidenceModel:
    def __init__(self):
        self.objects = {}
        self.references = {}
        self.dispositions = []

    def put(self, obj):
        key = (obj.tenant_id, obj.object_id, obj.version_id)
        if key in self.objects:
            raise ValueError("immutable version already exists")
        if digest(obj.content) != obj.declared_digest:
            raise ValueError("content digest mismatch")
        self.objects[key] = obj

    def resolve(self, tenant, object_id, version_id, purpose="AUDIT"):
        key = (tenant, object_id, version_id)
        obj = self.objects.get(key)
        if obj is None:
            raise LookupError("exact tenant-scoped version not found")
        if digest(obj.content) != obj.declared_digest:
            raise ValueError("stored bytes failed digest verification")
        if obj.retention_state in {"DISPOSED", "DISPOSITION_IN_PROGRESS"}:
            raise PermissionError("object unavailable under disposition")
        if not purpose:
            raise PermissionError("purpose required")
        return obj.content

    def manifest(self, tenant, operation, fingerprint, entries):
        normalized = []
        for entry in entries:
            if entry["tenant_id"] != tenant:
                raise PermissionError("cross-tenant manifest entry")
            key = (tenant, entry["object_id"], entry["version_id"])
            obj = self.objects.get(key)
            if obj is None:
                raise LookupError("unresolved immutable version")
            if entry["digest"] != obj.declared_digest:
                raise ValueError("manifest digest does not bind object")
            normalized.append(dict(entry))
        identities = [(e["object_id"], e["version_id"]) for e in normalized]
        if len(identities) != len(set(identities)):
            raise ValueError("duplicate object version")
        normalized.sort(key=lambda e: (e["object_id"], e["version_id"]))
        body = {
            "schema": "evidence-manifest.v1",
            "tenant_id": tenant,
            "operation_id": operation,
            "request_fingerprint": fingerprint,
            "entries": normalized,
        }
        encoded = canonical_bytes(body)
        return {"body": body, "canonical": encoded, "digest": digest(encoded)}

    def dispose(self, tenant, object_id, version_id, authorized=False):
        key = (tenant, object_id, version_id)
        obj = self.objects.get(key)
        if obj is None:
            raise LookupError("object not found")
        if obj.legal_hold:
            raise PermissionError("legal hold blocks disposition")
        if not authorized:
            raise PermissionError("explicit disposition authorization required")
        self.dispositions.append((key, "DISPOSITION_AUTHORIZED"))
        self.objects[key] = ObjectVersion(
            obj.tenant_id, obj.object_id, obj.version_id, obj.content,
            obj.declared_digest, obj.classification, "DISPOSED", obj.legal_hold
        )


class EvidencePackageContractTests(unittest.TestCase):
    def setUp(self):
        self.store = EvidenceModel()
        payload = b"verified receipt"
        self.obj = ObjectVersion("tenant-a", "ev-1", "v1", payload, digest(payload))
        self.store.put(self.obj)
        self.entry = {
            "tenant_id": "tenant-a", "object_id": "ev-1",
            "version_id": "v1", "digest": self.obj.declared_digest,
            "purpose": "EXECUTION_RECEIPT",
        }

    def test_exact_immutable_version_resolves(self):
        self.assertEqual(self.store.resolve("tenant-a", "ev-1", "v1"), b"verified receipt")

    def test_unknown_newer_version_does_not_fall_back(self):
        with self.assertRaises(LookupError):
            self.store.resolve("tenant-a", "ev-1", "latest")

    def test_cross_tenant_resolution_denied(self):
        with self.assertRaises(LookupError):
            self.store.resolve("tenant-b", "ev-1", "v1")

    def test_immutable_version_cannot_be_overwritten(self):
        with self.assertRaises(ValueError):
            self.store.put(self.obj)

    def test_ingest_rejects_wrong_digest(self):
        with self.assertRaises(ValueError):
            self.store.put(ObjectVersion("tenant-a", "ev-2", "v1", b"x", "0" * 64))

    def test_stored_byte_mutation_detected(self):
        self.store.objects[("tenant-a", "ev-1", "v1")] = ObjectVersion(
            "tenant-a", "ev-1", "v1", b"tampered", self.obj.declared_digest
        )
        with self.assertRaises(ValueError):
            self.store.resolve("tenant-a", "ev-1", "v1")

    def test_manifest_binds_tenant_operation_and_fingerprint(self):
        result = self.store.manifest("tenant-a", "op-1", "fp-1", [self.entry])
        self.assertEqual(result["body"]["operation_id"], "op-1")
        self.assertEqual(result["body"]["request_fingerprint"], "fp-1")
        self.assertEqual(result["body"]["tenant_id"], "tenant-a")

    def test_manifest_canonicalization_is_order_independent(self):
        second_payload = b"second"
        second = ObjectVersion("tenant-a", "ev-2", "v1", second_payload, digest(second_payload))
        self.store.put(second)
        entry2 = {"tenant_id": "tenant-a", "object_id": "ev-2",
                  "version_id": "v1", "digest": second.declared_digest, "purpose": "LOG"}
        a = self.store.manifest("tenant-a", "op-1", "fp-1", [self.entry, entry2])
        b = self.store.manifest("tenant-a", "op-1", "fp-1", [entry2, self.entry])
        self.assertEqual(a["canonical"], b["canonical"])
        self.assertEqual(a["digest"], b["digest"])

    def test_manifest_rejects_duplicate_object_version(self):
        with self.assertRaises(ValueError):
            self.store.manifest("tenant-a", "op-1", "fp-1", [self.entry, self.entry])

    def test_manifest_rejects_cross_tenant_entry(self):
        foreign = dict(self.entry, tenant_id="tenant-b")
        with self.assertRaises(PermissionError):
            self.store.manifest("tenant-a", "op-1", "fp-1", [foreign])

    def test_manifest_rejects_unresolved_version(self):
        missing = dict(self.entry, version_id="v9")
        with self.assertRaises(LookupError):
            self.store.manifest("tenant-a", "op-1", "fp-1", [missing])

    def test_manifest_rejects_digest_substitution(self):
        altered = dict(self.entry, digest="f" * 64)
        with self.assertRaises(ValueError):
            self.store.manifest("tenant-a", "op-1", "fp-1", [altered])

    def test_empty_purpose_rejected_by_resolver(self):
        with self.assertRaises(PermissionError):
            self.store.resolve("tenant-a", "ev-1", "v1", purpose="")

    def test_legal_hold_blocks_disposition(self):
        held = ObjectVersion("tenant-a", "held", "v1", b"hold", digest(b"hold"), legal_hold=True)
        self.store.put(held)
        with self.assertRaises(PermissionError):
            self.store.dispose("tenant-a", "held", "v1", authorized=True)

    def test_disposition_requires_explicit_authorization(self):
        with self.assertRaises(PermissionError):
            self.store.dispose("tenant-a", "ev-1", "v1", authorized=False)

    def test_authorized_disposition_is_recorded(self):
        self.store.dispose("tenant-a", "ev-1", "v1", authorized=True)
        self.assertEqual(self.store.dispositions[-1][1], "DISPOSITION_AUTHORIZED")
        with self.assertRaises(PermissionError):
            self.store.resolve("tenant-a", "ev-1", "v1")

    def test_tenant_namespace_prevents_object_id_collision(self):
        other = ObjectVersion("tenant-b", "ev-1", "v1", b"other", digest(b"other"))
        self.store.put(other)
        self.assertEqual(self.store.resolve("tenant-b", "ev-1", "v1"), b"other")
        self.assertEqual(self.store.resolve("tenant-a", "ev-1", "v1"), b"verified receipt")

    def test_manifest_digest_changes_when_fingerprint_changes(self):
        a = self.store.manifest("tenant-a", "op-1", "fp-1", [self.entry])
        b = self.store.manifest("tenant-a", "op-1", "fp-2", [self.entry])
        self.assertNotEqual(a["digest"], b["digest"])

    def test_manifest_digest_changes_when_operation_changes(self):
        a = self.store.manifest("tenant-a", "op-1", "fp-1", [self.entry])
        b = self.store.manifest("tenant-a", "op-2", "fp-1", [self.entry])
        self.assertNotEqual(a["digest"], b["digest"])

    def test_disposition_unknown_object_rejected(self):
        with self.assertRaises(LookupError):
            self.store.dispose("tenant-a", "missing", "v1", authorized=True)


if __name__ == "__main__":
    unittest.main()
