from __future__ import annotations

from .distributed import DistributedCoordinator, WorkItem


class WorkerPool:
    """Small orchestration facade for assigning queued work to capable workers."""

    def __init__(self, coordinator: DistributedCoordinator) -> None:
        self.coordinator = coordinator

    def dispatch_once(self) -> list[tuple[str, WorkItem]]:
        assignments: list[tuple[str, WorkItem]] = []
        snapshot = self.coordinator.snapshot()
        for worker_id, info in snapshot["workers"].items():
            if not info["healthy"]:
                continue
            while info["active_tasks"] < 1:
                item = self.coordinator.claim(worker_id)
                if item is None:
                    break
                assignments.append((worker_id, item))
                info["active_tasks"] += 1
        return assignments
