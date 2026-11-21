from __future__ import annotations

import hashlib
import json
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable


@dataclass(frozen=True)
class Task:
    id: str
    kind: str
    payload: dict[str, Any]
    attempts: int = 0
    created_at: float = field(default_factory=time.time)


@dataclass(frozen=True)
class Receipt:
    task_id: str
    status: str
    attempts: int
    started_at: float
    finished_at: float
    evidence_sha256: str
    result: dict[str, Any]


class TaskStore:
    def __init__(self) -> None:
        self.pending: dict[str, Task] = {}
        self.running: set[str] = set()
        self.receipts: dict[str, Receipt] = {}

    def put(self, task: Task) -> None:
        self.pending[task.id] = task

    def claim(self) -> Task | None:
        for task_id, task in list(self.pending.items()):
            if task_id not in self.running:
                self.running.add(task_id)
                del self.pending[task_id]
                return task
        return None

    def finish(self, receipt: Receipt) -> None:
        self.running.discard(receipt.task_id)
        self.receipts[receipt.task_id] = receipt


class Runtime:
    """Local execution runtime; durable stores and external adapters plug in here."""
    def __init__(self, handlers: dict[str, Callable[[dict[str, Any]], Awaitable[dict[str, Any]]]] | None = None) -> None:
        self.store = TaskStore()
        self.handlers = handlers or {}

    def submit(self, kind: str, payload: dict[str, Any]) -> str:
        task_id = str(uuid.uuid4())
        self.store.put(Task(task_id, kind, payload))
        return task_id

    async def run_once(self) -> Receipt | None:
        task = self.store.claim()
        if task is None:
            return None
        started = time.time()
        try:
            handler = self.handlers.get(task.kind)
            if handler is None:
                raise KeyError(f"no handler for {task.kind}")
            result = await handler(task.payload)
            status = "completed"
        except Exception as exc:
            result = {"error": type(exc).__name__, "message": str(exc)}
            status = "failed"
        finished = time.time()
        evidence = hashlib.sha256(json.dumps({"task": task.id, "status": status, "result": result}, sort_keys=True).encode()).hexdigest()
        receipt = Receipt(task.id, status, task.attempts + 1, started, finished, evidence, result)
        self.store.finish(receipt)
        return receipt

    async def drain(self) -> list[Receipt]:
        receipts: list[Receipt] = []
        while self.store.pending:
            receipt = await self.run_once()
            if receipt is not None:
                receipts.append(receipt)
        return receipts
