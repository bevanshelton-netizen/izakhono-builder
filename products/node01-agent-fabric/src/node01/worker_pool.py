from __future__ import annotations

from .distributed import DistributedCoordinator, WorkItem


class WorkerPool:
    """Small orchestration facade for assigning queued work to capable workers."""

    def __init__(self, coordinator: DistributedCoordinator) -> None:
        self.coordinator = coordinator

    def dispatch_once(self) -> list[tuple[str, WorkItem]]:
        """Assign as much currently available work as workers can accept."""
        assignments: list[tuple[str, WorkItem]] = []
        progress = True

        while progress:
            progress = False
            snapshot = self.coordinator.snapshot()
            for worker_id, info in snapshot["workers"].items():
                if not info["healthy"]:
                    continue
                if info["state"] in {"draining", "offline"}:
                    continue
                item = self.coordinator.claim(worker_id)
                if item is None:
                    continue
                assignments.append((worker_id, item))
                progress = True

        return assignments
