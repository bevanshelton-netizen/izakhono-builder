from __future__ import annotations

from dataclasses import replace
from .models import AgentSpec, Risk
from .registry import AGENTS, REGISTRY


class SubagentFactory:
    """Create capability-scoped subagents without changing the orchestrator."""

    def create(
        self,
        agent_id: str,
        name: str,
        domain: str,
        capabilities: set[str],
        risks: set[Risk] | None = None,
        max_concurrency: int = 1,
    ) -> AgentSpec:
        if not agent_id or agent_id in REGISTRY:
            raise ValueError("agent_id must be unique and non-empty")
        if not capabilities:
            raise ValueError("at least one capability is required")
        spec = AgentSpec(
            id=agent_id,
            name=name,
            domain=domain,
            capabilities=frozenset(capabilities),
            risks=frozenset(risks or {Risk.READ}),
            max_concurrency=max(1, max_concurrency),
        )
        AGENTS.append(spec)
        REGISTRY[agent_id] = spec
        return spec

    def clone_with_capability(self, source_agent_id: str, agent_id: str, name: str, capability: str) -> AgentSpec:
        source = REGISTRY.get(source_agent_id)
        if source is None:
            raise KeyError(source_agent_id)
        return self.create(agent_id, name, source.domain, set(source.capabilities) | {capability}, set(source.risks), source.max_concurrency)


FACTORY = SubagentFactory()
