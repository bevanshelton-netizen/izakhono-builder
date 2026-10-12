from pathlib import Path

import pytest

from node01.persistent_queue import SQLiteTaskQueue
from node01.persistent_worker import PersistentWorker


def test_queue_survives_reopen(tmp_path: Path) -> None:
    path = tmp_path / "node01.db"
    queue = SQLiteTaskQueue(path)
    task_id = queue.submit("research", {"topic": "Africa"}, "job-1")
    queue.close()

    reopened = SQLiteTaskQueue(path)
    lease = reopened.lease("worker-1", {"research"})
    assert lease is not None
    assert lease.task_id == task_id
    reopened.complete(lease, {"ok": True})
    assert reopened.snapshot()["completed"] == 1
    reopened.close()


def test_idempotency_is_durable(tmp_path: Path) -> None:
    path = tmp_path / "node01.db"
    queue = SQLiteTaskQueue(path)
    queue.submit("build", {"x": 1}, "same-key")
    with pytest.raises(ValueError):
        queue.submit("build", {"x": 2}, "same-key")
    queue.close()


def test_lease_owner_is_enforced() -> None:
    queue = SQLiteTaskQueue()
    queue.submit("ops", {"action": "health"}, "ops-1")
    lease = queue.lease("worker-a", {"ops"})
    assert lease is not None
    forged = type(lease)(lease.task_id, lease.capability, lease.payload, lease.idempotency_key, "worker-b", lease.lease_until, lease.attempt)
    with pytest.raises(PermissionError):
        queue.complete(forged, {"ok": False})
    queue.complete(lease, {"ok": True})
    queue.close()


def test_worker_failure_requeues_then_dead_letters() -> None:
    queue = SQLiteTaskQueue(max_attempts=2)
    queue.submit("unstable", {"x": 1}, "unstable-1")
    worker = PersistentWorker(queue, "worker-1", {"unstable"}, {"unstable": lambda _: (_ for _ in ()).throw(RuntimeError("boom"))})

    assert worker.run_once() is True
    assert queue.snapshot()["queued"] == 1
    assert worker.run_once() is True
    assert queue.snapshot()["dead_letter"] == 1
    queue.close()
