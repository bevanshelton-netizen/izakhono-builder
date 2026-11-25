"""Synthetic conformance tests for the independent verifier operational contract.

This is an in-memory reference model. It does not implement cryptography,
service identity, source adapters, trusted time, durable storage or production
incident response.
"""
import unittest
from dataclasses import dataclass, field


@dataclass(frozen=True)
class VerifierIdentity:
    tenant_id: str
    read_only: bool
    audiences: frozenset
    active: bool = True


@dataclass(frozen=True)
class SourceRecord:
    source: str
    tenant_id: str
    operation_id: str
    authenticated: bool = True
    observed_age_seconds: int = 0


@dataclass(frozen=True)
class TrustKey:
    key_id: str
    purpose: str
    trusted: bool = True
    revoked: bool = False


@dataclass(frozen=True)
class VerificationProfile:
    profile_id: str
    version: str
    max_source_age_seconds: int = 60
    require_trusted_time: bool = True


@dataclass
class FindingsLedger:
    findings: list = field(default_factory=list)

    def append(self, finding):
        if any(item["finding_id"] == finding["finding_id"] for item in self.findings):
            raise ValueError("duplicate finding")
        self.findings.append(dict(finding))

    def overwrite(self, finding_id, replacement):
        raise PermissionError("findings are append-only")

    def delete(self, finding_id):
        raise PermissionError("findings are append-only")


def verify(identity, sources, keys, profile, *, trusted_time_healthy=True,
           outcome_used_as_authorization=False):
    if not identity.active or not identity.read_only:
        return "REJECTED"
    if not identity.audiences or any(aud not in {
        "operations.read", "fortress.read", "identity.read", "runtime.read",
        "host-receipts.read", "evidence.read", "events.read", "audit.read"
    } for aud in identity.audiences):
        return "REJECTED"
    if not profile.profile_id or not profile.version:
        return "REJECTED"
    if profile.require_trusted_time and not trusted_time_healthy:
        return "UNKNOWN"
    if not sources:
        return "UNKNOWN"
    for source in sources:
        if not source.authenticated:
            return "UNKNOWN"
        if source.tenant_id != identity.tenant_id:
            return "REJECTED"
        if source.observed_age_seconds < 0 or source.observed_age_seconds > profile.max_source_age_seconds:
            return "UNKNOWN"
        if source.operation_id != sources[0].operation_id:
            return "REJECTED"
    for key in keys:
        if not key.trusted or key.revoked or not key.key_id or not key.purpose:
            return "REJECTED"
    if outcome_used_as_authorization:
        return "REJECTED"
    return "VERIFIED_EFFECT"


class IndependentVerifierOperationalContractTests(unittest.TestCase):
    def setUp(self):
        self.identity = VerifierIdentity(
            "tenant-a", True,
            frozenset({"operations.read", "fortress.read", "runtime.read",
                       "host-receipts.read", "evidence.read", "events.read",
                       "audit.read", "identity.read"})
        )
        self.sources = [
            SourceRecord("operation", "tenant-a", "op-1"),
            SourceRecord("fortress", "tenant-a", "op-1"),
            SourceRecord("runtime", "tenant-a", "op-1"),
            SourceRecord("host", "tenant-a", "op-1"),
            SourceRecord("evidence", "tenant-a", "op-1"),
            SourceRecord("audit", "tenant-a", "op-1"),
        ]
        self.keys = [TrustKey("key-1", "fortress-decision"),
                     TrustKey("key-2", "host-receipt")]
        self.profile = VerificationProfile("baseline", "1.0")

    def test_accepts_scoped_read_only_identity_and_fresh_sources(self):
        self.assertEqual(verify(self.identity, self.sources, self.keys, self.profile),
                         "VERIFIED_EFFECT")

    def test_rejects_write_capable_verifier(self):
        identity = VerifierIdentity("tenant-a", False, self.identity.audiences)
        self.assertEqual(verify(identity, self.sources, self.keys, self.profile), "REJECTED")

    def test_rejects_inactive_verifier(self):
        identity = VerifierIdentity("tenant-a", True, self.identity.audiences, False)
        self.assertEqual(verify(identity, self.sources, self.keys, self.profile), "REJECTED")

    def test_rejects_unknown_audience(self):
        identity = VerifierIdentity("tenant-a", True, frozenset({"operations.write"}))
        self.assertEqual(verify(identity, self.sources, self.keys, self.profile), "REJECTED")

    def test_rejects_cross_tenant_source(self):
        sources = list(self.sources)
        sources[2] = SourceRecord("runtime", "tenant-b", "op-1")
        self.assertEqual(verify(self.identity, sources, self.keys, self.profile), "REJECTED")

    def test_rejects_cross_operation_source(self):
        sources = list(self.sources)
        sources[1] = SourceRecord("fortress", "tenant-a", "op-2")
        self.assertEqual(verify(self.identity, sources, self.keys, self.profile), "REJECTED")

    def test_missing_sources_is_unknown(self):
        self.assertEqual(verify(self.identity, [], self.keys, self.profile), "UNKNOWN")

    def test_unauthenticated_source_is_unknown(self):
        sources = list(self.sources)
        sources[0] = SourceRecord("operation", "tenant-a", "op-1", False)
        self.assertEqual(verify(self.identity, sources, self.keys, self.profile), "UNKNOWN")

    def test_stale_source_is_unknown(self):
        sources = list(self.sources)
        sources[-1] = SourceRecord("audit", "tenant-a", "op-1", True, 61)
        self.assertEqual(verify(self.identity, sources, self.keys, self.profile), "UNKNOWN")

    def test_negative_source_age_is_unknown(self):
        sources = list(self.sources)
        sources[0] = SourceRecord("operation", "tenant-a", "op-1", True, -1)
        self.assertEqual(verify(self.identity, sources, self.keys, self.profile), "UNKNOWN")

    def test_unhealthy_trusted_time_is_unknown(self):
        self.assertEqual(verify(self.identity, self.sources, self.keys, self.profile,
                                trusted_time_healthy=False), "UNKNOWN")

    def test_untrusted_key_is_rejected(self):
        keys = [TrustKey("key-1", "fortress-decision", trusted=False)]
        self.assertEqual(verify(self.identity, self.sources, keys, self.profile), "REJECTED")

    def test_revoked_key_is_rejected(self):
        keys = [TrustKey("key-1", "fortress-decision", revoked=True)]
        self.assertEqual(verify(self.identity, self.sources, keys, self.profile), "REJECTED")

    def test_missing_key_identity_is_rejected(self):
        keys = [TrustKey("", "fortress-decision")]
        self.assertEqual(verify(self.identity, self.sources, keys, self.profile), "REJECTED")

    def test_missing_profile_version_is_rejected(self):
        profile = VerificationProfile("baseline", "")
        self.assertEqual(verify(self.identity, self.sources, self.keys, profile), "REJECTED")

    def test_verifier_result_cannot_be_used_as_authorization(self):
        self.assertEqual(verify(self.identity, self.sources, self.keys, self.profile,
                                outcome_used_as_authorization=True), "REJECTED")

    def test_findings_are_append_only(self):
        ledger = FindingsLedger()
        ledger.append({"finding_id": "f-1", "outcome": "UNKNOWN"})
        with self.assertRaises(PermissionError):
            ledger.overwrite("f-1", {"finding_id": "f-1", "outcome": "VERIFIED_EFFECT"})
        with self.assertRaises(PermissionError):
            ledger.delete("f-1")
        self.assertEqual(ledger.findings[0]["outcome"], "UNKNOWN")

    def test_duplicate_finding_id_is_rejected(self):
        ledger = FindingsLedger()
        ledger.append({"finding_id": "f-1", "outcome": "UNKNOWN"})
        with self.assertRaises(ValueError):
            ledger.append({"finding_id": "f-1", "outcome": "VERIFIED_EFFECT"})

    def test_compromise_response_revokes_access_and_preserves_findings(self):
        ledger = FindingsLedger()
        ledger.append({"finding_id": "f-1", "outcome": "VERIFIED_EFFECT"})
        compromised = VerifierIdentity("tenant-a", True, self.identity.audiences, False)
        self.assertEqual(verify(compromised, self.sources, self.keys, self.profile), "REJECTED")
        self.assertEqual(len(ledger.findings), 1)
        self.assertEqual(ledger.findings[0]["finding_id"], "f-1")

    def test_profile_requires_trusted_time_by_default(self):
        self.assertTrue(self.profile.require_trusted_time)

    def test_tenant_scope_is_explicit(self):
        self.assertEqual(self.identity.tenant_id, "tenant-a")


if __name__ == "__main__":
    unittest.main()
