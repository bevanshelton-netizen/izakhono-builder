from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from .model_router import ModelRequest, ModelRouter
from .models import Risk, Task
from .policy import Policy


@dataclass(frozen=True)
class ToolProposal:
    name: str
    arguments: dict[str, Any]
    risk: Risk = Risk.READ


@dataclass(frozen=True)
class AgentDecision:
    task_id: str
    agent_id: str
    content: str
    tool_proposals: tuple[ToolProposal, ...]
    provider: str
    model: str
    evidence_hash: str


class AgentIntelligence:
    """Turns model output into a governed decision; it never executes tools itself."""

    def __init__(self, router: ModelRouter, policy: Policy | None = None) -> None:
        self.router = router
        self.policy = policy or Policy()

    def decide(self, task: Task, agent_id: str, correlation_id: str | None = None) -> AgentDecision:
        request = ModelRequest(
            task_id=task.id,
            agent_id=agent_id,
            prompt=task.description,
            required_capabilities=frozenset({"text.reasoning", "structured.output"}),
            correlation_id=correlation_id,
        )
        response = self.router.route(request)
        proposals = self._parse_tool_proposals(response.content)
        approved: list[ToolProposal] = []
        for proposal in proposals:
            proposed_task = Task(
                id=f"{task.id}:tool:{proposal.name}",
                title=proposal.name,
                description=f"Model-proposed tool call: {proposal.name}",
                capability=proposal.name,
                risk=proposal.risk,
                approval_required=task.approval_required,
            )
            decision = self.policy.evaluate(proposed_task)
            if decision.allowed and not decision.approval_required:
                approved.append(proposal)
        return AgentDecision(
            task_id=task.id,
            agent_id=agent_id,
            content=response.content,
            tool_proposals=tuple(approved),
            provider=response.provider,
            model=response.model,
            evidence_hash=response.evidence_hash,
        )

    @staticmethod
    def _parse_tool_proposals(content: str) -> list[ToolProposal]:
        try:
            payload = json.loads(content)
        except (TypeError, ValueError):
            return []
        raw = payload.get("tool_proposals", []) if isinstance(payload, dict) else []
        proposals: list[ToolProposal] = []
        for item in raw:
            if not isinstance(item, dict) or not isinstance(item.get("name"), str):
                continue
            risk_value = item.get("risk", Risk.READ.value)
            try:
                risk = Risk(risk_value)
            except ValueError:
                risk = Risk.DESTRUCTIVE
            proposals.append(ToolProposal(item["name"], dict(item.get("arguments", {})), risk))
        return proposals
