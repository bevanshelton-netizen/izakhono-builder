from node01.persistent_queue import SQLiteTaskQueue
from node01.persistent_worker import PersistentWorker
from node01.supervisor import WorkforceSupervisor


def test_supervisor_dispatches_across_workers() -> None:
    queue = SQLiteTaskQueue()
    seen: list[str] = []
    queue.submit("research", {"x": 1}, "job-1")
    queue.submit("ops", {"x": 2}, "job-2")
    workers = [
        PersistentWorker(queue, "research-1", {"research"}, {"research": lambda p: seen.append("research") or {"ok": True}}),
        PersistentWorker(queue, "ops-1", {"ops"}, {"ops": lambda p: seen.append("ops") or {"ok": True}}),
    ]
    receipt = WorkforceSupervisor(queue, workers).run_cycle(max_tasks=2)
    assert receipt.processed == 2
    assert set(seen) == {"research", "ops"}
    assert receipt.snapshot["completed"] == 2
    assert receipt.evidence_hash
    queue.close()


def test_supervisor_recovers_expired_leases() -> None:
    queue = SQLiteTaskQueue()
    queue.submit("ops", {"x": 1}, "job-1")
    lease = queue.lease("dead-worker", {"ops"}, lease_seconds=1)
    assert lease is not None
    queue._db.execute("UPDATE tasks SET lease_until=0 WHERE task_id=?", (lease.task_id,))
    queue._db.commit()
    worker = PersistentWorker(queue, "live-worker", {"ops"}, {"ops": lambda p: {"ok": True}})
    receipt = WorkforceSupervisor(queue, [worker]).run_cycle(max_tasks=1)
    assert receipt.recovered == 1
    assert receipt.snapshot["completed"] == 1
    queue.close()
