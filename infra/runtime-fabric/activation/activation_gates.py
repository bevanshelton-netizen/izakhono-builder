"""Final activation gate model for the IZAKHONO Runtime Fabric.

A runtime target is a logical/virtual deployment target. It is not assumed to
be a physical server. Public traffic is permitted only when the immutable
release and the selected runtime target have passed every production gate.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum


class ActivationStatus(str, Enum):
    BLOCKED = "blocked"
    READY = "ready"
    LIVE_VERIFIED = "live-verified"


@dataclass(frozen=True)
class ActivationEvidence:
    release_verified: bool
    runtime_healthy: bool
    deployment_verified: bool
    edge_verified: bool
    tls_verified: bool
    dns_verified: bool
    smoke_test_verified: bool
    rollback_ready: bool


@dataclass(frozen=True)
class ActivationDecision:
    status: ActivationStatus
    reasons: tuple[str, ...]

    @property
    def may_route_public_traffic(self) -> bool:
        return self.status == ActivationStatus.LIVE_VERIFIED


def evaluate(evidence: ActivationEvidence) -> ActivationDecision:
    required = {
        "release": evidence.release_verified,
        "runtime": evidence.runtime_healthy,
        "deployment": evidence.deployment_verified,
        "edge": evidence.edge_verified,
        "tls": evidence.tls_verified,
        "dns": evidence.dns_verified,
        "smoke": evidence.smoke_test_verified,
        "rollback": evidence.rollback_ready,
    }
    missing = tuple(name for name, passed in required.items() if not passed)
    if missing:
        return ActivationDecision(ActivationStatus.BLOCKED, tuple(f"missing:{name}" for name in missing))
    return ActivationDecision(ActivationStatus.LIVE_VERIFIED, ("all-production-gates-passed",))
