"""Synthetic tenant-isolation contract tests for IZAKHONO AI Workforce.

This is an isolated test-only reference model. It does not query a production
registry, database, cache, object store, search index, backup or evidence service.
It is not a production tenant-isolation implementation or security assurance.
"""
from __future__ import annotations

import unittest
from dataclasses import dataclass
from typing import Any, Callable, Iterable, Mapping


class ContractError(ValueError):
    """Stable rejection codes for this synthetic model only."""


@dataclass(frozen=True)
class QueryScope:
    tenant_id: str
    query_fingerprint: str
    object_scope: str = "agent"


def _require_nonempty(value: Any, code: str) -> None:
    if not isinstance(value, str) or not value.strip():
        raise ContractError(code)


def scoped_query(
    records: Iterable[Mapping[str, Any]], *, scope: QueryScope,
    filters: Mapping[str, Any] | None = None,
) -> list[Mapping[str, Any]]:
    """Return only records owned by the authenticated tenant, then filter."""
    _require_nonempty(scope.tenant_id, "TENANT_UNKNOWN")
    _require_nonempty(scope.query_fingerprint, "QUERY_FINGERPRINT_MISSING")
    filters = filters or {}
    return [
        record for record in records
        if isinstance(record, Mapping)
        and record.get("tenant_id") == scope.tenant_id
        and all(record.get(key) == value for key, value in filters.items())
    ]


def issue_cursor(
    *, scope: QueryScope, offset: int,
    signer: Callable[[Mapping[str, Any]], str] | None,
) -> dict[str, Any]:
    if type(offset) is not int or offset < 0:
        raise ContractError("CURSOR_OFFSET_INVALID")
    if signer is None:
        raise ContractError("CURSOR_SIGNER_UNAVAILABLE")
    payload = {
        "tenant_id": scope.tenant_id,
        "query_fingerprint": scope.query_fingerprint,
        "object_scope": scope.object_scope,
        "offset": offset,
    }
    signature = signer(payload)
    if not isinstance(signature, str) or not signature:
        raise ContractError("CURSOR_SIGNATURE_NOT_CREATED")
    return {**payload, "signature": signature}


def verify_cursor(
    cursor: Mapping[str, Any], *, expected_scope: QueryScope,
    verifier: Callable[[Mapping[str, Any]], bool] | None,
) -> int:
    if not isinstance(cursor, Mapping):
        raise ContractError("CURSOR_INVALID_MAPPING")
    required = ("tenant_id", "query_fingerprint", "object_scope", "offset", "signature")
    if any(field not in cursor or cursor[field] in (None, "") for field in required):
        raise ContractError("CURSOR_INCOMPLETE")
    if cursor["tenant_id"] != expected_scope.tenant_id:
        raise ContractError("CURSOR_TENANT_MISMATCH")
    if cursor["query_fingerprint"] != expected_scope.query_fingerprint:
        raise ContractError("CURSOR_QUERY_MISMATCH")
    if cursor["object_scope"] != expected_scope.object_scope:
        raise ContractError("CURSOR_OBJECT_SCOPE_MISMATCH")
    if type(cursor["offset"]) is not int or cursor["offset"] < 0:
        raise ContractError("CURSOR_OFFSET_INVALID")
    if verifier is None or not verifier(cursor):
        raise ContractError("CURSOR_SIGNATURE_NOT_VERIFIED")
    return cursor["offset"]


def verify_export(
    manifest: Mapping[str, Any], items: Iterable[Mapping[str, Any]], *,
    expected_tenant: str,
    verifier: Callable[[Mapping[str, Any]], bool] | None,
) -> None:
    if not isinstance(manifest, Mapping):
        raise ContractError("EXPORT_MANIFEST_INVALID")
    required = ("export_id", "tenant_id", "item_ids", "item_count", "content_digest", "signature")
    if any(field not in manifest or manifest[field] in (None, "") for field in required):
        raise ContractError("EXPORT_MANIFEST_INCOMPLETE")
    if manifest["tenant_id"] != expected_tenant:
        raise ContractError("EXPORT_TENANT_MISMATCH")
    if type(manifest["item_count"]) is not int or manifest["item_count"] < 0:
        raise ContractError("EXPORT_ITEM_COUNT_INVALID")
    if not isinstance(manifest["item_ids"], list):
        raise ContractError("EXPORT_ITEM_IDS_INVALID")
    if len(set(manifest["item_ids"])) != len(manifest["item_ids"]):
        raise ContractError("EXPORT_ITEM_IDS_DUPLICATED")
    materialized = list(items)
    if manifest["item_count"] != len(materialized) or manifest["item_count"] != len(manifest["item_ids"]):
        raise ContractError("EXPORT_ITEM_COUNT_MISMATCH")
    if any(not isinstance(item, Mapping) or item.get("tenant_id") != expected_tenant
           for item in materialized):
        raise ContractError("EXPORT_ITEM_TENANT_MISMATCH")
    if {item.get("object_id") for item in materialized} != set(manifest["item_ids"]):
        raise ContractError("EXPORT_ITEM_SET_MISMATCH")
    if verifier is None or not verifier(manifest):
        raise ContractError("EXPORT_SIGNATURE_NOT_VERIFIED")


def retrieve_evidence(
    evidence: Mapping[str, Any], *, tenant_id: str, object_scope: str,
    object_id: str, verifier: Callable[[Mapping[str, Any]], bool] | None,
) -> Mapping[str, Any]:
    if not isinstance(evidence, Mapping):
        raise ContractError("EVIDENCE_INVALID_MAPPING")
    required = ("evidence_id", "tenant_id", "object_scope", "object_id", "digest", "signature")
    if any(field not in evidence or evidence[field] in (None, "") for field in required):
        raise ContractError("EVIDENCE_INCOMPLETE")
    if evidence["tenant_id"] != tenant_id:
        raise ContractError("EVIDENCE_TENANT_MISMATCH")
    if evidence["object_scope"] != object_scope:
        raise ContractError("EVIDENCE_OBJECT_SCOPE_MISMATCH")
    if evidence["object_id"] != object_id:
        raise ContractError("EVIDENCE_OBJECT_ID_MISMATCH")
    if verifier is None or not verifier(evidence):
        raise ContractError("EVIDENCE_NOT_VERIFIED")
    return evidence


def tenant_cache_key(*, tenant_id: str, namespace: str, object_id: str) -> str:
    for value, code in (
        (tenant_id, "CACHE_TENANT_MISSING"),
        (namespace, "CACHE_NAMESPACE_MISSING"),
        (object_id, "CACHE_OBJECT_ID_MISSING"),
    ):
        _require_nonempty(value, code)
    return f"tenant:{tenant_id}:{namespace}:{object_id}"


def verify_restore_snapshot(
    snapshot: Mapping[str, Any], *, expected_tenant: str, expected_scope: str,
    verifier: Callable[[Mapping[str, Any]], bool] | None,
) -> None:
    if not isinstance(snapshot, Mapping):
        raise ContractError("RESTORE_SNAPSHOT_INVALID")
    required = ("snapshot_id", "tenant_id", "scope", "content_digest", "signature")
    if any(field not in snapshot or snapshot[field] in (None, "") for field in required):
        raise ContractError("RESTORE_SNAPSHOT_INCOMPLETE")
    if snapshot["tenant_id"] != expected_tenant:
        raise ContractError("RESTORE_TENANT_MISMATCH")
    if snapshot["scope"] != expected_scope:
        raise ContractError("RESTORE_SCOPE_MISMATCH")
    if verifier is None or not verifier(snapshot):
        raise ContractError("RESTORE_SNAPSHOT_NOT_VERIFIED")


class TenantQueryAndCursorTests(unittest.TestCase):
    def setUp(self):
        self.scope = QueryScope("tenant-a", "sha256:query-a", "agent")
        self.records = [
            {"tenant_id": "tenant-a", "object_id": "a-1", "state": "ACTIVE"},
            {"tenant_id": "tenant-b", "object_id": "b-1", "state": "ACTIVE"},
            {"tenant_id": "tenant-a", "object_id": "a-2", "state": "PAUSED"},
        ]

    def test_query_returns_only_authenticated_tenant(self):
        result = scoped_query(self.records, scope=self.scope)
        self.assertEqual({r["object_id"] for r in result}, {"a-1", "a-2"})

    def test_query_applies_filter_inside_tenant_scope(self):
        result = scoped_query(self.records, scope=self.scope, filters={"state": "ACTIVE"})
        self.assertEqual([r["object_id"] for r in result], ["a-1"])

    def test_unknown_tenant_fails_closed(self):
        with self.assertRaisesRegex(ContractError, "TENANT_UNKNOWN"):
            scoped_query(self.records, scope=QueryScope("", "sha256:q"))

    def test_cursor_is_bound_to_tenant_and_query(self):
        signer = lambda payload: "sig:" + payload["tenant_id"] + ":" + payload["query_fingerprint"]
        cursor = issue_cursor(scope=self.scope, offset=10, signer=signer)
        verifier = lambda value: value["signature"] == signer(value)
        self.assertEqual(verify_cursor(cursor, expected_scope=self.scope, verifier=verifier), 10)

    def test_cursor_replay_across_tenant_is_rejected(self):
        signer = lambda payload: "synthetic-signature"
        cursor = issue_cursor(scope=self.scope, offset=2, signer=signer)
        with self.assertRaisesRegex(ContractError, "CURSOR_TENANT_MISMATCH"):
            verify_cursor(cursor, expected_scope=QueryScope("tenant-b", "sha256:query-a"),
                          verifier=lambda value: True)

    def test_cursor_replay_across_filter_or_query_is_rejected(self):
        cursor = issue_cursor(scope=self.scope, offset=2, signer=lambda payload: "sig")
        with self.assertRaisesRegex(ContractError, "CURSOR_QUERY_MISMATCH"):
            verify_cursor(cursor, expected_scope=QueryScope("tenant-a", "sha256:query-other"),
                          verifier=lambda value: True)

    def test_cursor_replay_across_object_scope_is_rejected(self):
        cursor = issue_cursor(scope=self.scope, offset=2, signer=lambda payload: "sig")
        with self.assertRaisesRegex(ContractError, "CURSOR_OBJECT_SCOPE_MISMATCH"):
            verify_cursor(cursor, expected_scope=QueryScope("tenant-a", "sha256:query-a", "evidence"),
                          verifier=lambda value: True)

    def test_cursor_signature_unknown_fails_closed(self):
        cursor = issue_cursor(scope=self.scope, offset=2, signer=lambda payload: "sig")
        with self.assertRaisesRegex(ContractError, "CURSOR_SIGNATURE_NOT_VERIFIED"):
            verify_cursor(cursor, expected_scope=self.scope, verifier=None)


class ExportAndEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.items = [
            {"tenant_id": "tenant-a", "object_id": "agent-1"},
            {"tenant_id": "tenant-a", "object_id": "agent-2"},
        ]
        self.manifest = {
            "export_id": "export-1", "tenant_id": "tenant-a",
            "item_ids": ["agent-1", "agent-2"], "item_count": 2,
            "content_digest": "sha256:export", "signature": "synthetic-signature",
        }
        self.verify_signature = lambda value: value.get("signature") == "synthetic-signature"

    def test_accepts_export_with_exact_tenant_item_set(self):
        verify_export(self.manifest, self.items, expected_tenant="tenant-a",
                      verifier=self.verify_signature)

    def test_rejects_cross_tenant_export_manifest(self):
        with self.assertRaisesRegex(ContractError, "EXPORT_TENANT_MISMATCH"):
            verify_export(dict(self.manifest, tenant_id="tenant-b"), self.items,
                          expected_tenant="tenant-a", verifier=self.verify_signature)

    def test_rejects_cross_tenant_item_in_export(self):
        items = [self.items[0], dict(self.items[1], tenant_id="tenant-b")]
        with self.assertRaisesRegex(ContractError, "EXPORT_ITEM_TENANT_MISMATCH"):
            verify_export(self.manifest, items, expected_tenant="tenant-a",
                          verifier=self.verify_signature)

    def test_rejects_incomplete_export_item_set(self):
        wrong_items = [self.items[0], {"tenant_id": "tenant-a", "object_id": "agent-3"}]
        with self.assertRaisesRegex(ContractError, "EXPORT_ITEM_SET_MISMATCH"):
            verify_export(self.manifest, wrong_items, expected_tenant="tenant-a",
                          verifier=self.verify_signature)

    def test_rejects_duplicate_export_ids(self):
        manifest = dict(self.manifest, item_ids=["agent-1", "agent-1"])
        with self.assertRaisesRegex(ContractError, "EXPORT_ITEM_IDS_DUPLICATED"):
            verify_export(manifest, self.items, expected_tenant="tenant-a",
                          verifier=self.verify_signature)

    def test_export_verification_unknown_fails_closed(self):
        with self.assertRaisesRegex(ContractError, "EXPORT_SIGNATURE_NOT_VERIFIED"):
            verify_export(self.manifest, self.items, expected_tenant="tenant-a", verifier=None)

    def test_evidence_requires_matching_tenant_and_object_scope(self):
        evidence = {
            "evidence_id": "ev-1", "tenant_id": "tenant-a",
            "object_scope": "agent", "object_id": "agent-1",
            "digest": "sha256:evidence", "signature": "synthetic-signature",
        }
        self.assertEqual(retrieve_evidence(
            evidence, tenant_id="tenant-a", object_scope="agent", object_id="agent-1",
            verifier=self.verify_signature,
        ), evidence)

    def test_evidence_from_another_tenant_is_rejected(self):
        evidence = {
            "evidence_id": "ev-1", "tenant_id": "tenant-b",
            "object_scope": "agent", "object_id": "agent-1",
            "digest": "sha256:evidence", "signature": "synthetic-signature",
        }
        with self.assertRaisesRegex(ContractError, "EVIDENCE_TENANT_MISMATCH"):
            retrieve_evidence(evidence, tenant_id="tenant-a", object_scope="agent",
                              object_id="agent-1", verifier=self.verify_signature)

    def test_evidence_from_another_object_scope_is_rejected(self):
        evidence = {
            "evidence_id": "ev-1", "tenant_id": "tenant-a",
            "object_scope": "tenant", "object_id": "tenant-a",
            "digest": "sha256:evidence", "signature": "synthetic-signature",
        }
        with self.assertRaisesRegex(ContractError, "EVIDENCE_OBJECT_SCOPE_MISMATCH"):
            retrieve_evidence(evidence, tenant_id="tenant-a", object_scope="agent",
                              object_id="agent-1", verifier=self.verify_signature)

    def test_evidence_for_another_object_is_rejected(self):
        evidence = {
            "evidence_id": "ev-1", "tenant_id": "tenant-a",
            "object_scope": "agent", "object_id": "agent-2",
            "digest": "sha256:evidence", "signature": "synthetic-signature",
        }
        with self.assertRaisesRegex(ContractError, "EVIDENCE_OBJECT_ID_MISMATCH"):
            retrieve_evidence(evidence, tenant_id="tenant-a", object_scope="agent",
                              object_id="agent-1", verifier=self.verify_signature)

    def test_unknown_evidence_verification_fails_closed(self):
        evidence = {
            "evidence_id": "ev-1", "tenant_id": "tenant-a",
            "object_scope": "agent", "object_id": "agent-1",
            "digest": "sha256:evidence", "signature": "synthetic-signature",
        }
        with self.assertRaisesRegex(ContractError, "EVIDENCE_NOT_VERIFIED"):
            retrieve_evidence(evidence, tenant_id="tenant-a", object_scope="agent",
                              object_id="agent-1", verifier=None)


class CacheAndRestoreIsolationTests(unittest.TestCase):
    def test_cache_keys_are_tenant_namespaced(self):
        key_a = tenant_cache_key(tenant_id="tenant-a", namespace="agent", object_id="agent-1")
        key_b = tenant_cache_key(tenant_id="tenant-b", namespace="agent", object_id="agent-1")
        self.assertNotEqual(key_a, key_b)
        self.assertTrue(key_a.startswith("tenant:tenant-a:"))

    def test_cache_key_requires_tenant(self):
        with self.assertRaisesRegex(ContractError, "CACHE_TENANT_MISSING"):
            tenant_cache_key(tenant_id="", namespace="agent", object_id="agent-1")

    def test_restore_accepts_verified_snapshot_for_same_tenant(self):
        snapshot = {
            "snapshot_id": "snapshot-a", "tenant_id": "tenant-a",
            "scope": "tenant", "content_digest": "sha256:snapshot",
            "signature": "synthetic-signature",
        }
        verify_restore_snapshot(snapshot, expected_tenant="tenant-a",
                                expected_scope="tenant",
            verifier=lambda value: value["signature"] == "synthetic-signature")

    def test_restore_rejects_cross_tenant_snapshot(self):
        snapshot = {
            "snapshot_id": "snapshot-b", "tenant_id": "tenant-b",
            "scope": "tenant", "content_digest": "sha256:snapshot",
            "signature": "synthetic-signature",
        }
        with self.assertRaisesRegex(ContractError, "RESTORE_TENANT_MISMATCH"):
            verify_restore_snapshot(snapshot, expected_tenant="tenant-a", expected_scope="tenant",
                                    verifier=lambda value: True)

    def test_restore_rejects_wrong_scope(self):
        snapshot = {
            "snapshot_id": "snapshot-a", "tenant_id": "tenant-a",
            "scope": "agent", "content_digest": "sha256:snapshot",
            "signature": "synthetic-signature",
        }
        with self.assertRaisesRegex(ContractError, "RESTORE_SCOPE_MISMATCH"):
            verify_restore_snapshot(snapshot, expected_tenant="tenant-a", expected_scope="tenant",
                                    verifier=lambda value: True)

    def test_restore_verification_unknown_fails_closed(self):
        snapshot = {
            "snapshot_id": "snapshot-a", "tenant_id": "tenant-a",
            "scope": "tenant", "content_digest": "sha256:snapshot",
            "signature": "synthetic-signature",
        }
        with self.assertRaisesRegex(ContractError, "RESTORE_SNAPSHOT_NOT_VERIFIED"):
            verify_restore_snapshot(snapshot, expected_tenant="tenant-a", expected_scope="tenant",
                                    verifier=None)


if __name__ == "__main__":
    unittest.main(verbosity=2)
