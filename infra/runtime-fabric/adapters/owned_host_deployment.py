#!/usr/bin/env python3
"""Provider-neutral deployment adapter for IZAKHONO HOST.

This adapter is deliberately evidence-driven: callbacks represent operations
performed by the real runtime. The adapter itself never claims that a node is
healthy, never creates acceptance evidence, and never promotes a workload to
LIVE_VERIFIED.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Mapping


@dataclass(frozen=True)
class DeploymentResult:
    status: str
    node: str
    rollback_required: bool = False
    reason: str = ""


def deploy_to_owned_host(
    node: str,
    workload: Mapping,
    apply: Callable[[str, Mapping], bool],
    health: Callable[[str, Mapping], bool],
    rollback: Callable[[str, Mapping], bool],
) -> DeploymentResult:
    """Apply a workload, verify runtime health, and rollback on failed health."""
    if not node:
        return DeploymentResult("BLOCKED", node, reason="node is required")
    if not workload.get("workload"):
        return DeploymentResult("BLOCKED", node, reason="workload is required")

    if not apply(node, workload):
        return DeploymentResult("BLOCKED", node, reason="deployment operation failed")

    if health(node, workload):
        return DeploymentResult("DEPLOYED_HEALTHY", node)

    rollback_ok = rollback(node, workload)
    return DeploymentResult(
        "ROLLED_BACK" if rollback_ok else "ROLLBACK_REQUIRED",
        node,
        rollback_required=True,
        reason="post-deployment health check failed",
    )


if __name__ == "__main__":
    result = deploy_to_owned_host(
        "node01",
        {"workload": "kora-mail"},
        lambda *_: True,
        lambda *_: True,
        lambda *_: True,
    )
    assert result.status == "DEPLOYED_HEALTHY"
    print("OWNED_HOST_DEPLOYMENT_ADAPTER: PASS")
