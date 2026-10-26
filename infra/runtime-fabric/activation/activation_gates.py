"""Final activation gate model for Runtime Fabric.

Provisioning a machine is not the same as activating public traffic. This
module makes the distinction executable and auditable.
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
    node_healthy: bool
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
        "node": evidence.node_healthy,
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
