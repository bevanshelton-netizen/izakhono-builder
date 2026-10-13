from __future__ import annotations

from typing import Any


def build_health_snapshot(queue: Any, control: Any, workers: dict[str, Any] | None = None) -> dict[str, Any]:
    snapshot = {"queue": queue.snapshot(), "control": control.status()}
    if workers is not None:
        snapshot["workers"] = workers
    return snapshot
