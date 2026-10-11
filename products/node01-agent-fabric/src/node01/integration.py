from __future__ import annotations

from typing import Any
from .control_plane import Node01ControlPlane
from .models import AgentSpec, Task, TaskResult, TaskStatus
from .executors import Executor


class ControlPlaneExecutor(Executor):
    """Routes selected task capabilities into NODE01's control-plane adapters."""

    def __init__(self, control_plane: Node01ControlPlane | None = None) -> None:
        self.control_plane = control_plane or Node01ControlPlane()

    async def execute(self, agent: AgentSpec, task: Task, context: dict[str, Any]) -> TaskResult:
        mapping = {
            "ai.gateway": "ai.complete",
            "mail.draft": "mail.draft",
            "provision.plan": "provision.plan",
        }
        kind = mapping.get(task.capability)
        if kind is None:
            return TaskResult(task.id, TaskStatus.FAILED, agent.id, error=f"no control-plane route for {task.capability}")

        payload = dict(task.input)
        if kind == "ai.complete":
            payload.setdefault("prompt", task.description)
            payload.setdefault("context", context)
        envelope = await self.control_plane.submit(kind, payload)
        result = await self.control_plane.dispatch_once()
        return TaskResult(
            task.id,
            TaskStatus.COMPLETED,
            agent.id,
            result,
            [f"agent:{agent.id}", f"correlation:{envelope.correlation_id}"],
        )
