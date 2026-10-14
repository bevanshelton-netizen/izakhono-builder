from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from .engine import Orchestrator
from .executors import resolve_agent
from .intelligence import AgentDecision, AgentIntelligence
from .models import Task
from .observe import EventLedger
from .planner import plan
from .tool_fabric import ToolFabric, ToolRequest, ToolResult


@dataclass(frozen=True)
class TurnReceipt:
    task_id: str
    agent_id: str
    decision_hash: str
    tool_results: tuple[ToolResult, ...] = ()


@dataclass(frozen=True)
class OrchestrationResult:
    execution_id: str
    objective: str
    status: str
    turns: tuple[TurnReceipt, ...]
    task_results: tuple[Any, ...]
    evidence_hash: str
    correlation_id: str
    events: tuple[dict[str, Any], ...] = field(default_factory=tuple)


class AgentOrchestrator:
    """Coordinates planning, model reasoning, governed tools, review and evidence."""

    def __init__(
        self,
        intelligence: AgentIntelligence,
        tools: ToolFabric,
        event_ledger: EventLedger | None = None,
        max_turns: int = 16,
        max_tool_calls_per_turn: int = 4,
    ) -> None:
        if max_turns < 1 or max_tool_calls_per_turn < 1:
            raise ValueError("orchestration bounds must be positive")
        self.intelligence = intelligence
        self.tools = tools
        self.events = event_ledger or EventLedger()
        self.max_turns = max_turns
        self.max_tool_calls_per_turn = max_tool_calls_per_turn

    def run(self, objective: str, tasks: list[Task] | None = None, correlation_id: str | None = None) -> OrchestrationResult:
        execution_id = str(uuid.uuid4())
        correlation = correlation_id or execution_id
        graph = tasks or plan(objective)
        turns: list[TurnReceipt] = []
        self.events.append("orchestration.started", "node01.orchestrator", {"execution_id": execution_id, "objective": objective}, correlation)

        for task in graph[: self.max_turns]:
            agent = resolve_agent(task)
            if agent is None:
                self.events.append("orchestration.failed", "node01.orchestrator", {"task_id": task.id, "reason": "agent unavailable"}, correlation)
                return self._finish(execution_id, objective, "failed", turns, (), correlation)
            try:
                decision = self.intelligence.decide(task, agent.id, correlation)
            except Exception as exc:
                self.events.append("orchestration.failed", "node01.orchestrator", {"task_id": task.id, "reason": str(exc)}, correlation)
                return self._finish(execution_id, objective, "failed", turns, (), correlation)
            self.events.append("agent.decision", agent.id, {"task_id": task.id, "evidence_hash": decision.evidence_hash}, correlation)
            tool_results: list[ToolResult] = []
            for proposal in decision.tool_proposals[: self.max_tool_calls_per_turn]:
                result = self.tools.execute(ToolRequest(task.id, proposal.name, proposal.arguments, proposal.risk, correlation))
                tool_results.append(result)
                self.events.append("tool.result", proposal.name, {"task_id": task.id, "status": result.status, "evidence_hash": result.evidence_hash}, correlation)
                if result.status != "completed":
                    self.events.append("orchestration.failed", "node01.orchestrator", {"task_id": task.id, "reason": result.error or result.status}, correlation)
                    return self._finish(execution_id, objective, "blocked_or_failed", turns + [self._turn(task, agent.id, decision, tool_results)], (), correlation)
            turns.append(self._turn(task, agent.id, decision, tool_results))

        if len(graph) > self.max_turns:
            self.events.append("orchestration.failed", "node01.orchestrator", {"reason": "turn budget exhausted"}, correlation)
            return self._finish(execution_id, objective, "blocked_or_failed", turns, (), correlation)

        try:
            execution = asyncio.run(Orchestrator().run(objective, graph))
        except Exception as exc:
            self.events.append("orchestration.failed", "node01.orchestrator", {"reason": str(exc)}, correlation)
            return self._finish(execution_id, objective, "failed", turns, (), correlation)
        status = "completed" if execution.status == "completed" else "blocked_or_failed"
        self.events.append("orchestration.completed" if status == "completed" else "orchestration.failed", "node01.orchestrator", {"execution_id": execution_id, "status": status}, correlation)
        return self._finish(execution_id, objective, status, turns, tuple(execution.tasks), correlation)

    @staticmethod
    def _turn(task: Task, agent_id: str, decision: AgentDecision, results: list[ToolResult]) -> TurnReceipt:
        return TurnReceipt(task.id, agent_id, decision.evidence_hash, tuple(results))

    def _finish(self, execution_id: str, objective: str, status: str, turns: list[TurnReceipt], task_results: tuple[Any, ...], correlation: str) -> OrchestrationResult:
        events = tuple({"event_id": e.event_id, "event_type": e.event_type, "source": e.source, "correlation_id": e.correlation_id} for e in self.events.recent())
        payload = {"execution_id": execution_id, "objective": objective, "status": status, "turns": [t.__dict__ for t in turns], "task_results": [getattr(r, "__dict__", r) for r in task_results], "correlation_id": correlation}
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
        return OrchestrationResult(execution_id, objective, status, tuple(turns), task_results, digest, correlation, events)
