"""Synthetic interface vectors for the proposed evidence service boundary.

No network, FORTRESS integration, object store, database or real cryptography.
"""
import hashlib
import unittest


def sha(data):
    return hashlib.sha256(data).hexdigest()


class FakeFortress:
    def __init__(self, decision="ALLOW", tenant="tenant-a", purpose="AUDIT",
                 resource="evidence:ev-1:v1", audience="evidence-service",
                 active=True):
        self.decision = decision
        self.tenant = tenant
        self.purpose = purpose
        self.resource = resource
        self.audience = audience
        self.active = active

    def authorize(self, request):
        return (
            self.active
            and self.decision == "ALLOW"
            and request.get("tenant_id") == self.tenant
            and request.get("purpose") == self.purpose
            and request.get("resource") == self.resource
            and request.get("audience") == self.audience
        )


class EvidenceServiceModel:
    def __init__(self, fortress, tenant="tenant-a"):
        self.fortress = fortress
        self.tenant = tenant
        self.objects = {
            ("tenant-a", "ev-1", "v1"): b"immutable-evidence"
        }
        self.audit = []

    def resolve(self, request):
        required = ("principal_id", "tenant_id", "object_id", "version_id",
                    "purpose", "resource", "audience", "correlation_id")
        if any(not request.get(k) for k in required):
            return {"status": "REJECTED", "error": "INVALID_REQUEST"}
        if request["tenant_id"] != self.tenant:
            return {"status": "REJECTED", "error": "TENANT_SCOPE_DENIED"}
        if request.get("storage_locator") or request.get("latest"):
            return {"status": "REJECTED", "error": "EXACT_VERSION_REQUIRED"}
        if not self.fortress.authorize(request):
            return {"status": "REJECTED", "error": "POLICY_DENIED"}
        key = (request["tenant_id"], request["object_id"], request["version_id"])
        content = self.objects.get(key)
        if content is None:
            return {"status": "REJECTED", "error": "EVIDENCE_VERSION_NOT_FOUND"}
        expected = request.get("expected_digest")
        actual = sha(content)
        if expected != actual:
            return {"status": "REJECTED", "error": "EVIDENCE_DIGEST_MISMATCH"}
        self.audit.append({
            "tenant_id": request["tenant_id"],
            "object_id": request["object_id"],
            "version_id": request["version_id"],
            "principal_id": request["principal_id"],
            "purpose": request["purpose"],
            "correlation_id": request["correlation_id"],
        })
        return {
            "status": "VERIFIED",
            "tenant_id": request["tenant_id"],
            "object_id": request["object_id"],
            "version_id": request["version_id"],
            "digest": actual,
            "content": content,
            "audit_reference": "audit-" + str(len(self.audit)),
        }


class EvidenceServiceInterfaceTests(unittest.TestCase):
    def setUp(self):
        self.content = b"immutable-evidence"
        self.fortress = FakeFortress()
        self.service = EvidenceServiceModel(self.fortress)
        self.request = {
            "principal_id": "principal-1",
            "tenant_id": "tenant-a",
            "object_id": "ev-1",
            "version_id": "v1",
            "purpose": "AUDIT",
            "resource": "evidence:ev-1:v1",
            "audience": "evidence-service",
            "correlation_id": "corr-1",
            "expected_digest": sha(self.content),
        }

    def test_exact_authorized_version_resolves(self):
        result = self.service.resolve(self.request)
        self.assertEqual(result["status"], "VERIFIED")
        self.assertEqual(result["content"], self.content)
        self.assertEqual(result["version_id"], "v1")

    def test_missing_authenticated_principal_rejected(self):
        request = dict(self.request, principal_id="")
        self.assertEqual(self.service.resolve(request)["error"], "INVALID_REQUEST")

    def test_missing_purpose_rejected(self):
        request = dict(self.request, purpose="")
        self.assertEqual(self.service.resolve(request)["error"], "INVALID_REQUEST")

    def test_tenant_scope_mismatch_rejected(self):
        request = dict(self.request, tenant_id="tenant-b")
        self.assertEqual(self.service.resolve(request)["error"], "TENANT_SCOPE_DENIED")

    def test_fortress_deny_blocks_resolution(self):
        self.service.fortress = FakeFortress(decision="DENY")
        self.assertEqual(self.service.resolve(self.request)["error"], "POLICY_DENIED")

    def test_wrong_fortress_purpose_blocks_resolution(self):
        self.service.fortress = FakeFortress(purpose="EXPORT")
        self.assertEqual(self.service.resolve(self.request)["error"], "POLICY_DENIED")

    def test_wrong_fortress_audience_blocks_resolution(self):
        self.service.fortress = FakeFortress(audience="other-service")
        self.assertEqual(self.service.resolve(self.request)["error"], "POLICY_DENIED")

    def test_revoked_or_inactive_decision_blocks_resolution(self):
        self.service.fortress = FakeFortress(active=False)
        self.assertEqual(self.service.resolve(self.request)["error"], "POLICY_DENIED")

    def test_exact_version_required_no_latest_alias(self):
        request = dict(self.request, latest=True)
        self.assertEqual(self.service.resolve(request)["error"], "EXACT_VERSION_REQUIRED")

    def test_caller_storage_locator_rejected(self):
        request = dict(self.request, storage_locator="s3://bucket/key")
        self.assertEqual(self.service.resolve(request)["error"], "EXACT_VERSION_REQUIRED")

    def test_missing_historical_version_does_not_fallback(self):
        request = dict(self.request, version_id="v2")
        request["resource"] = "evidence:ev-1:v2"
        self.service.fortress = FakeFortress(resource="evidence:ev-1:v2")
        self.assertEqual(self.service.resolve(request)["error"], "EVIDENCE_VERSION_NOT_FOUND")

    def test_digest_mismatch_rejected(self):
        request = dict(self.request, expected_digest="0" * 64)
        self.assertEqual(self.service.resolve(request)["error"], "EVIDENCE_DIGEST_MISMATCH")

    def test_success_emits_scope_bound_audit(self):
        result = self.service.resolve(self.request)
        self.assertTrue(result["audit_reference"])
        self.assertEqual(len(self.service.audit), 1)
        self.assertEqual(self.service.audit[0]["tenant_id"], "tenant-a")
        self.assertEqual(self.service.audit[0]["principal_id"], "principal-1")
        self.assertEqual(self.service.audit[0]["correlation_id"], "corr-1")

    def test_denied_request_does_not_emit_success_audit_record(self):
        self.service.fortress = FakeFortress(decision="DENY")
        self.service.resolve(self.request)
        self.assertEqual(self.service.audit, [])

    def test_every_retry_rechecks_authorization(self):
        first = self.service.resolve(self.request)
        self.assertEqual(first["status"], "VERIFIED")
        self.service.fortress.active = False
        second = self.service.resolve(self.request)
        self.assertEqual(second["error"], "POLICY_DENIED")

    def test_response_does_not_expose_storage_locator_or_key(self):
        result = self.service.resolve(self.request)
        self.assertNotIn("storage_locator", result)
        self.assertNotIn("encryption_key", result)
        self.assertNotIn("credential", result)

    def test_audit_is_bound_to_exact_version(self):
        self.service.resolve(self.request)
        self.assertEqual(self.service.audit[0]["version_id"], "v1")

    def test_correlation_id_required(self):
        request = dict(self.request, correlation_id="")
        self.assertEqual(self.service.resolve(request)["error"], "INVALID_REQUEST")

    def test_foreign_object_id_not_disclosed(self):
        request = dict(self.request, object_id="other-tenant-secret")
        request["resource"] = "evidence:other-tenant-secret:v1"
        self.service.fortress = FakeFortress(resource="evidence:other-tenant-secret:v1")
        self.assertEqual(self.service.resolve(request)["error"], "EVIDENCE_VERSION_NOT_FOUND")


if __name__ == "__main__":
    unittest.main()
