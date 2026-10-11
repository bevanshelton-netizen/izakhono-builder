from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class TaskState(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    DEAD_LETTER = "dead_letter"


@dataclass
class Worker:
    id: str
    capabilities: frozenset[str]
    heartbeat_at: float = field(default_factory=time.time)
    active_task: str | None = None

    def heartbeat(self, now: float | None = None) -> None:
        self.heartbeat_at = time.time() if now is None else now


@dataclass
class ManagedTask:
    id: str
    kind: str
    payload: dict[str, Any]
    max_attempts: int = 3
    state: TaskState = TaskState.PENDING
    attempts: int = 0
    worker_id: str | None = None
    lease_until: float | None = None
    last_error: str | None = None


class RecoveryEngine:
    """In-process worker leases and recovery policy; persistence plugs in above this boundary."""

    def __init__(self, heartbeat_timeout: float = 30.0, lease_seconds: float = 60.0) -> None:
        self.heartbeat_timeout = heartbeat_timeout
        self.lease_seconds = lease_seconds
        self.workers: dict[str, Worker] = {}
        self.tasks: dict[str, ManagedTask] = {}
        self.dead_letters: list[str] = []

    def register_worker(self, capabilities: set[str]) -> str:
        worker_id = str(uuid.uuid4())
        self.workers[worker_id] = Worker(worker_id, frozenset(capabilities))
        return worker_id

    def submit(self, kind: str, payload: dict[str, Any], max_attempts: int = 3) -> str:
        task_id = str(uuid.uuid4())
        self.tasks[task_id] = ManagedTask(task_id, kind, payload, max(1, max_attempts))
        return task_id

    def claim(self, worker_id: str, task_id: str, now: float | None = None) -> bool:
        worker = self.workers[worker_id]
        task = self.tasks[task_id]
        if task.state != TaskState.PENDING or worker.active_task is not None:
            return False
        task.state = TaskState.RUNNING
        task.attempts += 1
        task.worker_id = worker_id
        task.lease_until = (time.time() if now is None else now) + self.lease_seconds
        worker.active_task = task_id
        return True

    def complete(self, worker_id: str, task_id: str) -> None:
        task = self.tasks[task_id]
        if task.worker_id != worker_id or task.state != TaskState.RUNNING:
            raise ValueError("worker does not own running task")
        task.state = TaskState.COMPLETED
        self.workers[worker_id].active_task = None
        task.lease_until = None

    def fail(self, worker_id: str, task_id: str, error: str) -> None:
        task = self.tasks[task_id]
        if task.worker_id != worker_id or task.state != TaskState.RUNNING:
            raise ValueError("worker does not own running task")
        task.last_error = error
        self.workers[worker_id].active_task = None
        task.lease_until = None
        if task.attempts >= task.max_attempts:
            task.state = TaskState.DEAD_LETTER
            self.dead_letters.append(task_id)
        else:
            task.state = TaskState.PENDING
            task.worker_id = None

    def recover(self, now: float | None = None) -> list[str]:
        current = time.time() if now is None else now
        recovered: list[str] = []
        for worker in self.workers.values():
            stale = current - worker.heartbeat_at > self.heartbeat_timeout
            task_id = worker.active_task
            if not stale or task_id is None:
                continue
            task = self.tasks[task_id]
            if task.state != TaskState.RUNNING:
                worker.active_task = None
                continue
            task.last_error = "worker heartbeat timeout"
            task.lease_until = None
            worker.active_task = None
            task.worker_id = None
            if task.attempts >= task.max_attempts:
                task.state = TaskState.DEAD_LETTER
                self.dead_letters.append(task.id)
            else:
                task.state = TaskState.PENDING
            recovered.append(task.id)
        return recovered

    def snapshot(self) -> dict[str, Any]:
        return {
            "workers": len(self.workers),
            "pending": sum(t.state == TaskState.PENDING for t in self.tasks.values()),
            "running": sum(t.state == TaskState.RUNNING for t in self.tasks.values()),
            "completed": sum(t.state == TaskState.COMPLETED for t in self.tasks.values()),
            "failed": sum(t.state == TaskState.FAILED for t in self.tasks.values()),
            "dead_letter": len(self.dead_letters),
        }
