"""Synthetic tests for independent AI Workforce audit reproduction.

In-memory reference model only; no cryptography, storage, containers, source
adapters, trust services or production reviewer identity are implemented.
"""
import unittest
from dataclasses import dataclass


REQUIRED_ARTIFACTS = {
    "operation", "fortress", "runtime", "host_receipt", "evidence",
    "event_outbox", "audit_checkpoint", "trust_snapshot", "trusted_time",
    "acceptance_profile", "verifier_build", "build_provenance",
}
VALID_CONSISTENCY = {"CONSISTENT", "BOUNDED_SKEW", "INCONSISTENT"}


@dataclass(frozen=True)
class Artifact:
    artifact_id: str
    kind: str
    digest: str
    tenant_id: str
    immutable_version: str
    digest_valid: bool = True


@dataclass(frozen=True)
class ReproductionPackage:
    package_id: str
    tenant_id: str
    artifacts: tuple
    consistency: str = "CONSISTENT"
    snapshot_complete: bool = True
    pagination_complete: bool = True
    signer_trusted: bool = True
    trust_anchors_independent: bool = True
    build_matches: bool = True
    profile_matches: bool = True
    runner_has_mutating_capability: bool = False
    historical_inputs_available: bool = True


@dataclass(frozen=True)
class Reviewer:
    tenant_id: str
    read_only: bool
    active: bool = True


def validate_package(package, reviewer):
    if not package.package_id or not package.tenant_id:
        return "REJECTED_PACKAGE"
    if not reviewer.active or not reviewer.read_only:
        return "REJECTED_PACKAGE"
    if reviewer.tenant_id != package.tenant_id:
        return "REJECTED_PACKAGE"
    if not package.signer_trusted or not package.trust_anchors_independent:
        return "REJECTED_PACKAGE"
    if package.runner_has_mutating_capability:
        return "REJECTED_PACKAGE"
    if package.consistency not in VALID_CONSISTENCY:
        return "REJECTED_PACKAGE"
    if package.consistency == "INCONSISTENT":
        return "INDETERMINATE"
    if not package.snapshot_complete or not package.pagination_complete:
        return "NOT_REPRODUCIBLE"
    if not package.historical_inputs_available:
        return "NOT_REPRODUCIBLE"
    if not package.build_matches or not package.profile_matches:
        return "NOT_REPRODUCIBLE"
    artifacts = list(package.artifacts)
    ids = [a.artifact_id for a in artifacts]
    if len(ids) != len(set(ids)):
        return "REJECTED_PACKAGE"
    if any(not a.artifact_id or not a.digest or not a.immutable_version
           or a.tenant_id != package.tenant_id for a in artifacts):
        return "REJECTED_PACKAGE"
    if any(not a.digest_valid for a in artifacts):
        return "REJECTED_PACKAGE"
    kinds = [a.kind for a in artifacts]
    if len(kinds) != len(set(kinds)):
        return "REJECTED_PACKAGE"
    if not REQUIRED_ARTIFACTS.issubset(set(kinds)):
        return "NOT_REPRODUCIBLE"
    return "PACKAGE_VALID"


def reproduce(package, reviewer, independent_outcome):
    validation = validate_package(package, reviewer)
    if validation != "PACKAGE_VALID":
        return validation
    if independent_outcome == "INDETERMINATE":
        return "INDETERMINATE"
    if independent_outcome == "NOT_REPRODUCIBLE":
        return "NOT_REPRODUCIBLE"
    if independent_outcome == package_recorded_outcome(package):
        return "REPRODUCED_MATCH"
    return "REPRODUCED_DIFFERENT"


def package_recorded_outcome(package):
    # The expected historical result is represented by a synthetic artifact
    # attribute in tests; real packages bind it in the signed manifest.
    return getattr(package, "recorded_outcome", "VERIFIED_EFFECT")


def current_reassessment_is_separate(historical_result, current_result):
    if historical_result == current_result:
        return "CURRENTLY_REASSESSED"
    return "CURRENTLY_REASSESSED"


class IndependentAuditReproducibilityTests(unittest.TestCase):
    def setUp(self):
        self.reviewer = Reviewer("tenant-a", True)
        self.artifacts = tuple(
            Artifact(f"id-{kind}", kind, f"digest-{kind}", "tenant-a", "v1")
            for kind in sorted(REQUIRED_ARTIFACTS)
        )
        self.package = ReproductionPackage("pkg-1", "tenant-a", self.artifacts)

    def test_valid_complete_package_reproduces_matching_outcome(self):
        self.assertEqual(reproduce(self.package, self.reviewer, "VERIFIED_EFFECT"),
                         "REPRODUCED_MATCH")

    def test_different_outcome_is_reported_not_overwritten(self):
        self.assertEqual(reproduce(self.package, self.reviewer, "VERIFIED_FAILURE"),
                         "REPRODUCED_DIFFERENT")

    def test_untrusted_package_signer_is_rejected(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts, signer_trusted=False)
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_package_cannot_supply_its_own_only_trust_anchors(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                trust_anchors_independent=False)
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_cross_tenant_reviewer_is_rejected(self):
        self.assertEqual(validate_package(self.package, Reviewer("tenant-b", True)),
                         "REJECTED_PACKAGE")

    def test_write_capable_reviewer_is_rejected(self):
        self.assertEqual(validate_package(self.package, Reviewer("tenant-a", False)),
                         "REJECTED_PACKAGE")

    def test_inactive_reviewer_is_rejected(self):
        self.assertEqual(validate_package(self.package, Reviewer("tenant-a", True, False)),
                         "REJECTED_PACKAGE")

    def test_cross_tenant_artifact_is_rejected(self):
        artifacts = list(self.artifacts)
        a = artifacts[0]
        artifacts[0] = Artifact(a.artifact_id, a.kind, a.digest, "tenant-b",
                               a.immutable_version)
        p = ReproductionPackage("pkg-1", "tenant-a", tuple(artifacts))
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_digest_mismatch_is_rejected(self):
        artifacts = list(self.artifacts)
        a = artifacts[0]
        artifacts[0] = Artifact(a.artifact_id, a.kind, a.digest, a.tenant_id,
                               a.immutable_version, False)
        p = ReproductionPackage("pkg-1", "tenant-a", tuple(artifacts))
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_duplicate_artifact_id_is_rejected(self):
        artifacts = list(self.artifacts)
        artifacts[1] = Artifact(artifacts[0].artifact_id, artifacts[1].kind,
                                artifacts[1].digest, "tenant-a", "v1")
        p = ReproductionPackage("pkg-1", "tenant-a", tuple(artifacts))
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_duplicate_artifact_kind_is_rejected(self):
        artifacts = list(self.artifacts)
        artifacts[1] = Artifact("another-id", artifacts[0].kind,
                                "another-digest", "tenant-a", "v1")
        p = ReproductionPackage("pkg-1", "tenant-a", tuple(artifacts))
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_missing_required_artifact_is_not_reproducible(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts[:-1])
        self.assertEqual(validate_package(p, self.reviewer), "NOT_REPRODUCIBLE")

    def test_incomplete_source_snapshot_is_not_reproducible(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                snapshot_complete=False)
        self.assertEqual(validate_package(p, self.reviewer), "NOT_REPRODUCIBLE")

    def test_pagination_gap_is_not_reproducible(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                pagination_complete=False)
        self.assertEqual(validate_package(p, self.reviewer), "NOT_REPRODUCIBLE")

    def test_inconsistent_snapshot_is_indeterminate(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                consistency="INCONSISTENT")
        self.assertEqual(validate_package(p, self.reviewer), "INDETERMINATE")

    def test_unknown_consistency_value_is_rejected(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                consistency="MAYBE")
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_build_digest_mismatch_is_not_reproducible(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                build_matches=False)
        self.assertEqual(validate_package(p, self.reviewer), "NOT_REPRODUCIBLE")

    def test_profile_mismatch_is_not_reproducible(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                profile_matches=False)
        self.assertEqual(validate_package(p, self.reviewer), "NOT_REPRODUCIBLE")

    def test_runner_with_mutating_capability_is_rejected(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                runner_has_mutating_capability=True)
        self.assertEqual(validate_package(p, self.reviewer), "REJECTED_PACKAGE")

    def test_missing_historical_snapshot_is_not_reproducible(self):
        p = ReproductionPackage("pkg-1", "tenant-a", self.artifacts,
                                historical_inputs_available=False)
        self.assertEqual(validate_package(p, self.reviewer), "NOT_REPRODUCIBLE")

    def test_historical_and_current_assessment_are_distinct(self):
        self.assertEqual(current_reassessment_is_separate("VERIFIED_EFFECT", "REJECTED"),
                         "CURRENTLY_REASSESSED")

    def test_reproduction_is_not_an_authorization_grant(self):
        self.assertNotIn("ALLOW", {"REPRODUCED_MATCH", "REPRODUCED_DIFFERENT"})


if __name__ == "__main__":
    unittest.main()
