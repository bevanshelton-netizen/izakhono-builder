from __future__ import annotations

import asyncio
import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any

from .executors import Executor, default_executor, resolve_agent
from .models import ExecutionReceipt, Task, TaskResult, TaskStatus
from .planner import plan
from .policy import Policy


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Orchestrator:
    def __init__(self, executor: Executor | None = None, policy: Policy | None = None, max_parallel: int = 8):
        self.executor = executor or default_executor()
        self.policy = policy or Policy()
        self.max_parallel = max_parallel

    async def run(self, objective: str, tasks: list[Task] | None = None) -> ExecutionReceipt:
        execution_id = str(uuid.uuid4())
        started = now()
        graph = tasks or plan(objective)
        results: dict[str, TaskResult] = {}
        decisions: list[dict[str, Any]] = []
        pending = {task.id: task for task in graph}
        semaphore = asyncio.Semaphore(self.max_parallel)
        context: dict[str, Any] = {"objective": objective}

        while pending:
            ready: list[Task] = []
            for task in pending.values():
                deps = [results.get(dep) for dep in task.depends_on]
                if all(r is not None for r in deps):
                    if any(r.status is not TaskStatus.COMPLETED for r in deps if r is not None):
                        results[task.id] = TaskResult(task.id, TaskStatus.SKIPPED, None, error="dependency failed or was skipped")
                    else:
                        ready.append(task)

            for task_id, result in list(results.items()):
                if task_id in pending and result.status is TaskStatus.SKIPPED:
                    pending.pop(task_id)

            if not ready:
                if pending:
                    for task in pending.values():
                        results[task.id] = TaskResult(task.id, TaskStatus.FAILED, None, error="dependency cycle or unresolved dependency")
                    pending.clear()
                break

            async def run_one(task: Task) -> TaskResult:
                decision = self.policy.evaluate(task)
                decisions.append({"task_id": task.id, "allowed": decision.allowed, "reason": decision.reason, "approval_required": decision.approval_required})
                if not decision.allowed:
                    return TaskResult(task.id, TaskStatus.BLOCKED, None, error=decision.reason)
                if decision.approval_required:
                    return TaskResult(task.id, TaskStatus.BLOCKED, None, error="awaiting explicit owner approval")
                agent = resolve_agent(task)
                if agent is None:
                    return TaskResult(task.id, TaskStatus.FAILED, None, error=f"no agent for capability {task.capability}")
                async with semaphore:
                    upstream = {dep: results[dep].output for dep in task.depends_on}
                    return await self.executor.execute(agent, task, {**context, "upstream": upstream})

            batch = await asyncio.gather(*(run_one(task) for task in ready))
            for task, result in zip(ready, batch):
                results[task.id] = result
                pending.pop(task.id, None)

        ordered = [results[task.id] for task in graph]
        status = "completed" if all(r.status is TaskStatus.COMPLETED for r in ordered) else "blocked_or_failed"
        receipt = ExecutionReceipt(execution_id, objective, started, now(), status, ordered, decisions)
        payload = json.dumps({
            "execution_id": receipt.execution_id,
            "objective": receipt.objective,
            "started_at": receipt.started_at,
            "completed_at": receipt.completed_at,
            "status": receipt.status,
            "tasks": [r.__dict__ for r in receipt.tasks],
            "policy_decisions": receipt.policy_decisions,
        }, sort_keys=True, default=str).encode()
        receipt.receipt_hash = hashlib.sha256(payload).hexdigest()
        return receipt


def run_sync(objective: str) -> ExecutionReceipt:
    return asyncio.run(Orchestrator().run(objective))
