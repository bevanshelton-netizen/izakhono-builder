from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .persistent_queue import Lease, SQLiteTaskQueue


Handler = Callable[[dict[str, Any]], dict[str, Any]]


class PersistentWorker:
    """Worker loop adapter backed by the durable NODE01 task queue."""

    def __init__(self, queue: SQLiteTaskQueue, worker_id: str, capabilities: set[str], handlers: dict[str, Handler], *, lease_seconds: float = 30.0) -> None:
        self.queue = queue
        self.worker_id = worker_id
        self.capabilities = set(capabilities)
        self.handlers = handlers
        self.lease_seconds = lease_seconds

    def run_once(self) -> bool:
        lease = self.queue.lease(self.worker_id, self.capabilities, lease_seconds=self.lease_seconds)
        if lease is None:
            return False
        self._execute(lease)
        return True

    def _execute(self, lease: Lease) -> None:
        handler = self.handlers.get(lease.capability)
        if handler is None:
            self.queue.fail(lease, f"no handler for capability: {lease.capability}")
            return
        try:
            result = handler(lease.payload)
            self.queue.complete(lease, result)
        except Exception as exc:
            self.queue.fail(lease, str(exc))

    def drain(self, limit: int | None = None) -> int:
        completed = 0
        while limit is None or completed < limit:
            if not self.run_once():
                break
            completed += 1
        return completed
