"""Provider-neutral Runtime Fabric orchestration.

This module deliberately owns orchestration policy, not provider credentials.
Providers implement the small RuntimeProvider protocol. The orchestrator selects
nodes according to the owned-first policy, provisions a node when needed, and
returns explicit gates for deployment/activation rather than claiming LIVE.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Protocol, Sequence


class RouteClass(str, Enum):
    OWNED = "owned"
    EXTERNAL_RESILIENCE = "external-resilience"


class NodeState(str, Enum):
    AVAILABLE = "available"
    PROVISIONABLE = "provisionable"
    DEGRADED = "degraded"
    DISABLED = "disabled"


@dataclass(frozen=True)
class RuntimeNode:
    node_id: str
    provider: str
    route_class: RouteClass
    state: NodeState
    failover_order: int
    region: str


@dataclass(frozen=True)
class Release:
    release_id: str
    version: str
    schema_version: str
    immutable: bool = True


@dataclass(frozen=True)
class Gate:
    name: str
    passed: bool
    detail: str


@dataclass(frozen=True)
class RuntimePlan:
    release: Release
    selected_node: RuntimeNode | None
    gates: tuple[Gate, ...]
    fallback_nodes: tuple[RuntimeNode, ...] = field(default_factory=tuple)

    @property
    def ready_for_activation(self) -> bool:
        return self.selected_node is not None and all(g.passed for g in self.gates)


class RuntimeProvider(Protocol):
    name: str

    def provision(self, node: RuntimeNode, release: Release) -> RuntimeNode:
        """Provision the requested provider node; must not mutate authority."""
        ...

    def health(self, node: RuntimeNode) -> bool:
        ...

    def deploy(self, node: RuntimeNode, release: Release) -> bool:
        ...


class RuntimeOrchestrator:
    def __init__(self, providers: Sequence[RuntimeProvider]):
        self.providers = {provider.name: provider for provider in providers}

    @staticmethod
    def rank(nodes: Sequence[RuntimeNode]) -> list[RuntimeNode]:
        """Owned-first, then failover order; never select disabled/degraded nodes."""
        eligible = [n for n in nodes if n.state in {NodeState.AVAILABLE, NodeState.PROVISIONABLE}]
        return sorted(
            eligible,
            key=lambda n: (0 if n.route_class == RouteClass.OWNED else 1, n.failover_order, n.node_id),
        )

    def plan(self, release: Release, nodes: Sequence[RuntimeNode]) -> RuntimePlan:
        gates = (
            Gate("release-immutable", release.immutable, "release must be immutable"),
            Gate("release-id", bool(release.release_id), "release id required"),
            Gate("schema-version", bool(release.schema_version), "schema version required"),
        )
        ranked = self.rank(nodes)
        selected = ranked[0] if ranked else None
        fallbacks = tuple(ranked[1:])
        return RuntimePlan(release, selected, gates, fallbacks)

    def execute(self, plan: RuntimePlan) -> RuntimePlan:
        if not plan.ready_for_activation:
            return plan

        candidates = (plan.selected_node, *plan.fallback_nodes)
        for node in candidates:
            provider = self.providers.get(node.provider)
            if provider is None:
                continue
            target = node
            if node.state == NodeState.PROVISIONABLE:
                target = provider.provision(node, plan.release)
            if not provider.health(target):
                continue
            if provider.deploy(target, plan.release):
                return RuntimePlan(
                    plan.release,
                    target,
                    plan.gates + (Gate("node-health", True, "runtime node healthy"), Gate("release-deploy", True, "release accepted by provider")),
                    tuple(n for n in candidates if n.node_id != target.node_id),
                )

        return RuntimePlan(
            plan.release,
            None,
            plan.gates + (Gate("runtime-selection", False, "no candidate passed provision, health and deployment gates"),),
            tuple(candidates),
        )
