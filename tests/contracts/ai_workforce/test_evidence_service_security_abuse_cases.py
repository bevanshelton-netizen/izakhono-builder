"""Synthetic adversarial tests for evidence-service threat-model invariants.

This reference model is intentionally not a production authorization or storage
implementation. It contains no network, real cryptography or durable database.
"""
import hashlib
import unittest
from dataclasses import dataclass


def digest(value):
    return hashlib.sha256(value).hexdigest()


@dataclass(frozen=True)
class Decision:
    tenant: str
    principal: str
    action: str
    resource: str
    purpose: str
    audience: str
    fingerprint: str
    expires_at: int
    revoked: bool = False
    allowed: bool = True


@dataclass
class Evidence:
    tenant: str
    object_id: str
    version: str
    content: bytes
    digest_value: str
    classification: str = "INTERNAL"
    legal_hold: bool = False
    disposed: bool = False


class AdversarialEvidenceBoundary:
    def __init__(self):
        self.now = 100
        self.audit_available = True
        self.audit = []
        self.evidence = Evidence(
            "tenant-a", "ev-1", "v1", b"evidence-bytes",
            digest(b"evidence-bytes")
        )

    def allow(self, request, decision):
        expected_resource = f"evidence:{request['object_id']}:{request['version']}"
        return all((
            decision.allowed,
            not decision.revoked,
            self.now < decision.expires_at,
            decision.tenant == request["tenant"],
            decision.principal == request["principal"],
            decision.action == "READ",
            decision.resource == expected_resource,
            decision.purpose == request["purpose"],
            decision.audience == "evidence-service",
            decision.fingerprint == request["fingerprint"],
        ))

    def resolve(self, request, decision, before_read=None):
        if request["tenant"] != "tenant-a":
            return "TENANT_SCOPE_DENIED"
        if not self.allow(request, decision):
            return "POLICY_DENIED"
        obj = self.evidence
        if (obj.tenant, obj.object_id, obj.version) != (
            request["tenant"], request["object_id"], request["version"]
        ):
            return "EVIDENCE_VERSION_NOT_FOUND"
        if obj.disposed:
            return "EVIDENCE_DISPOSED"
        if before_read:
            before_read(obj)
        if obj.legal_hold and request["purpose"] == "PUBLIC_EXPORT":
            return "LEGAL_HOLD_RESTRICTION"
        observed = bytes(obj.content)
        if digest(observed) != obj.digest_value:
            return "EVIDENCE_DIGEST_MISMATCH"
        if not self.audit_available:
            return "AUDIT_ACKNOWLEDGEMENT_UNAVAILABLE"
        self.audit.append((request["principal"], request["tenant"],
                           request["object_id"], request["version"]))
        return {"status": "VERIFIED", "bytes": observed,
                "digest": digest(observed)}

    def dispose(self, actor, approver, authorized, hold_cleared):
        if not authorized or actor == approver:
            return "DISPOSITION_DENIED"
        if self.evidence.legal_hold and not hold_cleared:
            return "LEGAL_HOLD_RESTRICTION"
        self.evidence.disposed = True
        return "DISPOSED"


class EvidenceServiceThreatModelTests(unittest.TestCase):
    def setUp(self):
        self.boundary = AdversarialEvidenceBoundary()
        self.request = {
            "tenant": "tenant-a",
            "principal": "principal-1",
            "object_id": "ev-1",
            "version": "v1",
            "purpose": "AUDIT",
            "fingerprint": "fp-1",
        }
        self.decision = Decision(
            "tenant-a", "principal-1", "READ", "evidence:ev-1:v1",
            "AUDIT", "evidence-service", "fp-1", 200
        )

    def test_valid_scope_passes(self):
        self.assertEqual(self.boundary.resolve(self.request, self.decision)["status"],
                         "VERIFIED")

    def test_tenant_spoofing_is_denied(self):
        req = dict(self.request, tenant="tenant-b")
        self.assertEqual(self.boundary.resolve(req, self.decision), "TENANT_SCOPE_DENIED")

    def test_decision_for_another_principal_is_denied(self):
        decision = Decision("tenant-a", "other", "READ", "evidence:ev-1:v1",
                            "AUDIT", "evidence-service", "fp-1", 200)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_wrong_resource_binding_is_denied(self):
        decision = Decision("tenant-a", "principal-1", "READ", "evidence:ev-2:v1",
                            "AUDIT", "evidence-service", "fp-1", 200)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_wrong_purpose_is_denied(self):
        decision = Decision("tenant-a", "principal-1", "READ", "evidence:ev-1:v1",
                            "EXPORT", "evidence-service", "fp-1", 200)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_wrong_audience_is_denied(self):
        decision = Decision("tenant-a", "principal-1", "READ", "evidence:ev-1:v1",
                            "AUDIT", "other-service", "fp-1", 200)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_expired_decision_is_denied(self):
        decision = Decision("tenant-a", "principal-1", "READ", "evidence:ev-1:v1",
                            "AUDIT", "evidence-service", "fp-1", 99)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_revoked_decision_is_denied(self):
        decision = Decision("tenant-a", "principal-1", "READ", "evidence:ev-1:v1",
                            "AUDIT", "evidence-service", "fp-1", 200, revoked=True)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_changed_request_fingerprint_is_denied(self):
        req = dict(self.request, fingerprint="fp-changed")
        self.assertEqual(self.boundary.resolve(req, self.decision), "POLICY_DENIED")

    def test_wrong_action_is_denied(self):
        decision = Decision("tenant-a", "principal-1", "WRITE", "evidence:ev-1:v1",
                            "AUDIT", "evidence-service", "fp-1", 200)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_denied_decision_is_denied(self):
        decision = Decision("tenant-a", "principal-1", "READ", "evidence:ev-1:v1",
                            "AUDIT", "evidence-service", "fp-1", 200, allowed=False)
        self.assertEqual(self.boundary.resolve(self.request, decision), "POLICY_DENIED")

    def test_content_swap_after_metadata_lookup_is_detected(self):
        def swap(obj):
            obj.content = b"substituted bytes"
        self.assertEqual(self.boundary.resolve(self.request, self.decision, swap),
                         "EVIDENCE_DIGEST_MISMATCH")

    def test_truncation_after_metadata_lookup_is_detected(self):
        def truncate(obj):
            obj.content = obj.content[:-3]
        self.assertEqual(self.boundary.resolve(self.request, self.decision, truncate),
                         "EVIDENCE_DIGEST_MISMATCH")

    def test_audit_unavailable_blocks_release(self):
        self.boundary.audit_available = False
        self.assertEqual(self.boundary.resolve(self.request, self.decision),
                         "AUDIT_ACKNOWLEDGEMENT_UNAVAILABLE")
        self.assertEqual(self.boundary.audit, [])

    def test_audit_event_is_attributed_to_request_principal(self):
        self.boundary.resolve(self.request, self.decision)
        self.assertEqual(self.boundary.audit[0][0], "principal-1")

    def test_legal_hold_blocks_public_export(self):
        self.boundary.evidence.legal_hold = True
        req = dict(self.request, purpose="PUBLIC_EXPORT")
        decision = Decision("tenant-a", "principal-1", "READ", "evidence:ev-1:v1",
                            "PUBLIC_EXPORT", "evidence-service", "fp-1", 200)
        self.assertEqual(self.boundary.resolve(req, decision),
                         "LEGAL_HOLD_RESTRICTION")

    def test_legal_hold_does_not_block_authorized_audit_purpose(self):
        self.boundary.evidence.legal_hold = True
        self.assertEqual(self.boundary.resolve(self.request, self.decision)["status"],
                         "VERIFIED")

    def test_operator_cannot_self_approve_disposition(self):
        self.assertEqual(self.boundary.dispose("operator-1", "operator-1", True, True),
                         "DISPOSITION_DENIED")

    def test_disposition_requires_authorization(self):
        self.assertEqual(self.boundary.dispose("operator-1", "approver-2", False, True),
                         "DISPOSITION_DENIED")

    def test_legal_hold_blocks_ordinary_disposition(self):
        self.boundary.evidence.legal_hold = True
        self.assertEqual(self.boundary.dispose("operator-1", "approver-2", True, False),
                         "LEGAL_HOLD_RESTRICTION")

    def test_disposed_object_cannot_be_returned(self):
        self.boundary.evidence.disposed = True
        self.assertEqual(self.boundary.resolve(self.request, self.decision),
                         "EVIDENCE_DISPOSED")

    def test_success_does_not_expose_internal_storage_locator_or_key(self):
        result = self.boundary.resolve(self.request, self.decision)
        self.assertNotIn("storage_locator", result)
        self.assertNotIn("encryption_key", result)
        self.assertNotIn("credential", result)


if __name__ == "__main__":
    unittest.main()
