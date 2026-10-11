from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Callable
from .models import AgentSpec, Task, TaskResult, TaskStatus
from .registry import find_agent


class Executor(ABC):
    @abstractmethod
    async def execute(self, agent: AgentSpec, task: Task, context: dict[str, Any]) -> TaskResult:
        raise NotImplementedError


@dataclass
class DeterministicExecutor(Executor):
    """Useful immediately on NODE01; model execution can be attached later."""

    handlers: dict[str, Callable[[Task, dict[str, Any]], dict[str, Any]]]

    async def execute(self, agent: AgentSpec, task: Task, context: dict[str, Any]) -> TaskResult:
        handler = self.handlers.get(task.capability)
        try:
            output = handler(task, context) if handler else {
                "agent": agent.id,
                "capability": task.capability,
                "result": "task accepted; no provider-specific adapter configured",
                "objective": task.description,
            }
            return TaskResult(task.id, TaskStatus.COMPLETED, agent.id, output, [f"agent:{agent.id}", f"task:{task.id}"])
        except Exception as exc:
            return TaskResult(task.id, TaskStatus.FAILED, agent.id, error=str(exc))


def default_executor() -> DeterministicExecutor:
    def scoped(task: Task, context: dict[str, Any]) -> dict[str, Any]:
        return {"scope": task.description, "deliverable": "execution scope", "inputs_seen": sorted(context)}

    def research(task: Task, context: dict[str, Any]) -> dict[str, Any]:
        return {"research": "adapter-ready", "query": task.description, "sources": []}

    def plan(task: Task, context: dict[str, Any]) -> dict[str, Any]:
        return {"plan": "agent graph accepted", "upstream": list(context)}

    def review(task: Task, context: dict[str, Any]) -> dict[str, Any]:
        return {"review": "evidence ledger assembled", "upstream": list(context)}

    return DeterministicExecutor({
        "product.strategy": scoped,
        "research.web": research,
        "product.plan": plan,
        "review.evidence": review,
    })


def resolve_agent(task: Task) -> AgentSpec | None:
    return find_agent(task.capability)
