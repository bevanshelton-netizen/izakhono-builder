"""Synthetic evidence storage lifecycle vectors; no production storage or DB."""
import hashlib
import unittest
from dataclasses import dataclass


def sha(data):
    return hashlib.sha256(data).hexdigest()


@dataclass
class Staged:
    tenant: str
    object_id: str
    version: str
    content: bytes
    digest: str
    state: str = "STAGED"
    legal_hold: bool = False


class LifecycleModel:
    def __init__(self):
        self.objects = {}
        self.references = {}
        self.operations = {}
        self.outbox = {}
        self.quarantine = set()

    def stage(self, tenant, object_id, version, content):
        key = (tenant, object_id, version)
        if key in self.objects:
            raise ValueError("immutable object version exists")
        obj = Staged(tenant, object_id, version, content, sha(content))
        self.objects[key] = obj
        self.quarantine.add(key)
        return key

    def commit_bundle(self, key, operation_id, fingerprint, fail_at=None):
        obj = self.objects[key]
        if obj.state != "STAGED" or sha(obj.content) != obj.digest:
            raise ValueError("staged evidence not verified")
        if fail_at == "before_commit":
            raise RuntimeError("simulated transaction failure")
        # Copy-on-write: publish all authoritative records only after validation.
        ref = {"tenant": obj.tenant, "key": key, "digest": obj.digest,
               "operation": operation_id, "fingerprint": fingerprint}
        operation = {"tenant": obj.tenant, "id": operation_id,
                     "fingerprint": fingerprint, "state": "ACCEPTED"}
        event = {"id": "evt:" + operation_id, "tenant": obj.tenant,
                 "operation": operation_id, "fingerprint": fingerprint}
        if fail_at == "during_commit":
            raise RuntimeError("simulated transaction failure")
        self.references[key] = ref
        self.operations[operation_id] = operation
        self.outbox[event["id"]] = event
        obj.state = "COMMITTED"
        self.quarantine.discard(key)

    def cleanup_orphan(self, key, authorized=False):
        obj = self.objects[key]
        if key in self.references:
            raise PermissionError("referenced object cannot be orphan-cleaned")
        if obj.legal_hold:
            raise PermissionError("legal hold blocks cleanup")
        if not authorized:
            raise PermissionError("authorized cleanup required")
        obj.state = "DISPOSED"
        self.quarantine.discard(key)

    def restore(self, backup_objects, backup_refs):
        restored = {}
        for key, record in backup_objects.items():
            if key not in backup_refs:
                continue
            if sha(record.content) != record.digest:
                raise ValueError("restore digest mismatch")
            ref = backup_refs[key]
            if ref["tenant"] != record.tenant or ref["digest"] != record.digest:
                raise ValueError("restore reference mismatch")
            restored[key] = record
        if set(backup_refs) != set(restored):
            raise LookupError("backup contains dangling references")
        return restored


class EvidenceStorageLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.model = LifecycleModel()
        self.key = self.model.stage("tenant-a", "object-1", "v1", b"receipt")

    def test_stage_creates_quarantined_immutable_version(self):
        self.assertIn(self.key, self.model.quarantine)
        self.assertEqual(self.model.objects[self.key].state, "STAGED")

    def test_failed_transaction_publishes_no_reference_operation_or_event(self):
        with self.assertRaises(RuntimeError):
            self.model.commit_bundle(self.key, "op-1", "fp-1", "before_commit")
        self.assertEqual(self.model.references, {})
        self.assertEqual(self.model.operations, {})
        self.assertEqual(self.model.outbox, {})
        self.assertIn(self.key, self.model.quarantine)

    def test_mid_transaction_failure_publishes_no_partial_records(self):
        with self.assertRaises(RuntimeError):
            self.model.commit_bundle(self.key, "op-1", "fp-1", "during_commit")
        self.assertEqual(self.model.references, {})
        self.assertEqual(self.model.operations, {})
        self.assertEqual(self.model.outbox, {})

    def test_success_commits_reference_operation_and_outbox_together(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        self.assertIn(self.key, self.model.references)
        self.assertIn("op-1", self.model.operations)
        self.assertIn("evt:op-1", self.model.outbox)
        self.assertEqual(self.model.objects[self.key].state, "COMMITTED")
        self.assertNotIn(self.key, self.model.quarantine)

    def test_committed_object_cannot_be_orphan_cleaned(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        with self.assertRaises(PermissionError):
            self.model.cleanup_orphan(self.key, authorized=True)

    def test_orphan_cleanup_requires_authorization(self):
        with self.assertRaises(PermissionError):
            self.model.cleanup_orphan(self.key, authorized=False)

    def test_legal_hold_blocks_orphan_cleanup(self):
        self.model.objects[self.key].legal_hold = True
        with self.assertRaises(PermissionError):
            self.model.cleanup_orphan(self.key, authorized=True)

    def test_authorized_orphan_cleanup_is_idempotent_in_state(self):
        self.model.cleanup_orphan(self.key, authorized=True)
        self.assertEqual(self.model.objects[self.key].state, "DISPOSED")
        self.assertNotIn(self.key, self.model.quarantine)

    def test_restore_reverifies_object_bytes(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        backup_objects = dict(self.model.objects)
        backup_refs = dict(self.model.references)
        restored = self.model.restore(backup_objects, backup_refs)
        self.assertIn(self.key, restored)

    def test_restore_rejects_corrupted_backup_bytes(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        backup_objects = dict(self.model.objects)
        backup_objects[self.key] = Staged("tenant-a", "object-1", "v1", b"tampered",
                                          self.model.objects[self.key].digest)
        with self.assertRaises(ValueError):
            self.model.restore(backup_objects, self.model.references)

    def test_restore_rejects_cross_tenant_reference(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        refs = dict(self.model.references)
        refs[self.key] = dict(refs[self.key], tenant="tenant-b")
        with self.assertRaises(ValueError):
            self.model.restore(self.model.objects, refs)

    def test_restore_rejects_dangling_reference(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        refs = dict(self.model.references)
        refs[("tenant-a", "missing", "v1")] = {
            "tenant": "tenant-a", "digest": "0" * 64
        }
        with self.assertRaises(LookupError):
            self.model.restore(self.model.objects, refs)

    def test_event_identity_is_stable_for_operation(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        self.assertEqual(list(self.model.outbox), ["evt:op-1"])

    def test_operation_and_event_bind_same_fingerprint(self):
        self.model.commit_bundle(self.key, "op-1", "fp-1")
        self.assertEqual(self.model.operations["op-1"]["fingerprint"],
                         self.model.outbox["evt:op-1"]["fingerprint"])

    def test_staged_bytes_mutation_blocks_commit(self):
        self.model.objects[self.key].content = b"changed"
        with self.assertRaises(ValueError):
            self.model.commit_bundle(self.key, "op-1", "fp-1")


if __name__ == "__main__":
    unittest.main()
