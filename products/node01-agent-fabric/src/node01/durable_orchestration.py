from __future__ import annotations

import json
import time
from dataclasses import dataclass
from typing import Any

from .orchestrator import AgentOrchestrator, OrchestrationResult
from .persistent_queue import SQLiteTaskQueue


@dataclass(frozen=True)
class DurableSubmission:
    task_id: str
    idempotency_key: str
    submitted_at: float


class DurableOrchestration:
    """Durable queue boundary for NODE01 orchestration requests."""

    CAPABILITY = "node01.orchestration"

    def __init__(self, queue: SQLiteTaskQueue, orchestrator: AgentOrchestrator) -> None:
        self.queue = queue
        self.orchestrator = orchestrator

    def submit(self, objective: str, *, correlation_id: str | None = None, idempotency_key: str | None = None) -> DurableSubmission:
        if not objective.strip():
            raise ValueError("objective must not be empty")
        payload = {"objective": objective, "correlation_id": correlation_id}
        key = idempotency_key or objective.strip()
        task_id = self.queue.submit(self.CAPABILITY, payload, key)
        return DurableSubmission(task_id, key, time.time())

    def handler(self, payload: dict[str, Any]) -> dict[str, Any]:
        result = self.orchestrator.run(str(payload["objective"]), correlation_id=payload.get("correlation_id"))
        return self._serialize(result)

    @staticmethod
    def _serialize(result: OrchestrationResult) -> dict[str, Any]:
        return json.loads(json.dumps(result, default=lambda value: value.__dict__, sort_keys=True))

    def worker_handlers(self) -> dict[str, Any]:
        return {self.CAPABILITY: self.handler}
