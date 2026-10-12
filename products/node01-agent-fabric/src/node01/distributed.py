from __future__ import annotations

import hashlib
import json
import threading
import time
import uuid
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class WorkerState(str, Enum):
    STARTING = "starting"
    READY = "ready"
    BUSY = "busy"
    DRAINING = "draining"
    OFFLINE = "offline"


@dataclass
class Worker:
    worker_id: str
    capabilities: frozenset[str]
    state: WorkerState = WorkerState.STARTING
    last_heartbeat: float = field(default_factory=time.time)
    active_tasks: int = 0
    max_concurrency: int = 1

    def heartbeat(self) -> None:
        self.last_heartbeat = time.time()
        if self.state is WorkerState.STARTING:
            self.state = WorkerState.READY

    def healthy(self, timeout_seconds: float = 30.0) -> bool:
        return self.state is not WorkerState.OFFLINE and time.time() - self.last_heartbeat <= timeout_seconds


@dataclass(frozen=True)
class WorkItem:
    task_id: str
    capability: str
    payload: dict[str, Any]
    idempotency_key: str
    created_at: float = field(default_factory=time.time)


@dataclass(frozen=True)
class WorkReceipt:
    task_id: str
    worker_id: str
    status: str
    idempotency_key: str
    completed_at: float
    evidence_hash: str


class DistributedCoordinator:
    """Thread-safe coordination boundary. Replace in-memory maps with a durable store/queue adapter in production."""

    def __init__(self, heartbeat_timeout: float = 30.0) -> None:
        self.heartbeat_timeout = heartbeat_timeout
        self._workers: dict[str, Worker] = {}
        self._queue: list[WorkItem] = []
        self._receipts: dict[str, WorkReceipt] = {}
        self._seen_keys: set[str] = set()
        self._lock = threading.RLock()

    def register(self, capabilities: set[str], max_concurrency: int = 1, worker_id: str | None = None) -> Worker:
        with self._lock:
            worker = Worker(worker_id or f"node01-worker-{uuid.uuid4().hex[:12]}", frozenset(capabilities), max_concurrency=max(1, max_concurrency))
            worker.heartbeat()
            self._workers[worker.worker_id] = worker
            return worker

    def heartbeat(self, worker_id: str) -> bool:
        with self._lock:
            worker = self._workers.get(worker_id)
            if not worker:
                return False
            worker.heartbeat()
            return True

    def submit(self, capability: str, payload: dict[str, Any], idempotency_key: str | None = None) -> WorkItem:
        with self._lock:
            key = idempotency_key or hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
            if key in self._seen_keys:
                raise ValueError(f"duplicate idempotency key: {key}")
            self._seen_keys.add(key)
            item = WorkItem(str(uuid.uuid4()), capability, payload, key)
            self._queue.append(item)
            return item

    def claim(self, worker_id: str) -> WorkItem | None:
        with self._lock:
            worker = self._workers.get(worker_id)
            if not worker or not worker.healthy() or worker.state in {WorkerState.DRAINING, WorkerState.OFFLINE}:
                return None
            if worker.active_tasks >= worker.max_concurrency:
                return None
            for index, item in enumerate(self._queue):
                if item.capability in worker.capabilities:
                    self._queue.pop(index)
                    worker.active_tasks += 1
                    worker.state = WorkerState.BUSY
                    return item
            return None

    def complete(self, worker_id: str, item: WorkItem, result: dict[str, Any], status: str = "completed") -> WorkReceipt:
        with self._lock:
            worker = self._workers.get(worker_id)
            if not worker or worker.active_tasks <= 0:
                raise PermissionError("worker does not own active work")
            worker.active_tasks -= 1
            if worker.state is WorkerState.BUSY and worker.active_tasks == 0:
                worker.state = WorkerState.READY
            canonical = json.dumps({"task_id": item.task_id, "worker_id": worker_id, "status": status, "result": result}, sort_keys=True)
            receipt = WorkReceipt(item.task_id, worker_id, status, item.idempotency_key, time.time(), hashlib.sha256(canonical.encode()).hexdigest())
            self._receipts[item.task_id] = receipt
            return receipt

    def reap_unhealthy(self) -> list[str]:
        with self._lock:
            stale = [worker_id for worker_id, worker in self._workers.items() if not worker.healthy(self.heartbeat_timeout)]
            for worker_id in stale:
                self._workers[worker_id].state = WorkerState.OFFLINE
            return stale

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return {
                "workers": {wid: {"state": w.state.value, "healthy": w.healthy(self.heartbeat_timeout), "active_tasks": w.active_tasks, "capabilities": sorted(w.capabilities)} for wid, w in self._workers.items()},
                "queued": len(self._queue),
                "receipts": len(self._receipts),
            }
