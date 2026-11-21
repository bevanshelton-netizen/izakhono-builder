from __future__ import annotations

import hashlib
import json
import time
from dataclasses import dataclass
from typing import Any

from .persistent_queue import SQLiteTaskQueue
from .persistent_worker import PersistentWorker


@dataclass(frozen=True)
class SupervisorReceipt:
    worker_id: str
    cycles: int
    processed: int
    recovered: int
    snapshot: dict[str, int]
    evidence_hash: str


class WorkforceSupervisor:
    """Coordinates durable NODE01 workers without bypassing queue policy."""

    def __init__(self, queue: SQLiteTaskQueue, workers: list[PersistentWorker]) -> None:
        if not workers:
            raise ValueError("at least one worker is required")
        self.queue = queue
        self.workers = list(workers)

    def recover(self) -> int:
        return self.queue.recover_expired()

    def run_cycle(self, *, max_tasks: int | None = None) -> SupervisorReceipt:
        started = time.time()
        recovered = self.recover()
        processed = 0
        cycles = 0
        remaining = max_tasks
        while remaining is None or remaining > 0:
            progressed = False
            cycles += 1
            for worker in self.workers:
                limit = 1 if remaining is None else min(1, remaining)
                count = worker.drain(limit)
                if count:
                    progressed = True
                    processed += count
                    if remaining is not None:
                        remaining -= count
                        if remaining <= 0:
                            break
            if not progressed:
                break
        snapshot = self.queue.snapshot()
        canonical = {
            "started": started,
            "cycles": cycles,
            "processed": processed,
            "recovered": recovered,
            "snapshot": snapshot,
            "workers": [w.worker_id for w in self.workers],
        }
        evidence_hash = hashlib.sha256(json.dumps(canonical, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
        return SupervisorReceipt(self.workers[0].worker_id, cycles, processed, recovered, snapshot, evidence_hash)

    def health(self) -> dict[str, Any]:
        return {
            "workers": [
                {"worker_id": w.worker_id, "capabilities": sorted(w.capabilities), "lease_seconds": w.lease_seconds}
                for w in self.workers
            ],
            "queue": self.queue.snapshot(),
        }
