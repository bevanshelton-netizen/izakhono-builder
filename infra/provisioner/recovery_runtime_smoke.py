"""Deterministic end-to-end recovery smoke for the Provisioner worker."""
from __future__ import annotations
from typing import Any
from adapter_catalog import CAPABILITY_TO_ADAPTER
from job_queue import JobQueue
from job_store import MemoryJobStore, StoredJob, utc_now
from worker_runtime import ProvisionerWorker, STATE_CAPABILITY

class MemoryRecoveryStore:
    def __init__(self) -> None:
        self.rows: dict[str, dict[str, Any]] = {}
    def record(self, **kwargs: Any) -> None:
        self.rows[kwargs["recovery_id"]] = dict(kwargs)
    def list_for_job(self, job_id: str) -> list[dict[str, Any]]:
        return [r for r in self.rows.values() if r["job_id"] == job_id]

def smoke() -> None:
    store = MemoryJobStore()
    queue = JobQueue(store)
    recovery = MemoryRecoveryStore()
    failed = {"value": True}

    def flaky(_request: dict[str, Any]) -> dict[str, Any]:
        if failed["value"]:
            failed["value"] = False
            raise RuntimeError("simulated adapter failure")
        return {"verified": True, "evidence_id": "ev-recovered", "observed_at": utc_now()}

    registry = {"adapters": {k: {"owned": v} for k, v in CAPABILITY_TO_ADAPTER.items()},
                "bindings": {name: {"operation": "smoke"} for name in STATE_CAPABILITY.values()}}
    implementations = {CAPABILITY_TO_ADAPTER["tenant"]: flaky}
    recovery_executors = {"reconcile_payment": lambda _job: {"verified": True, "reconciled": True}}

    job, _ = store.create_or_get("tenant-recovery", "idem-recovery", "prov-recovery")
    job.evidence["PAYMENT_VERIFIED"] = {"verified": True, "evidence_id": "pay-recovery"}
    store.save(job)
    queue.enqueue(job)
    worker = ProvisionerWorker(store, queue, implementations, registry,
                               recovery_store=recovery, recovery_executors=recovery_executors)

    first = worker.run_once()
    assert first is not None and first.status == "retry"
    assert recovery.rows["recovery_prov-recovery_op_prov-recovery_payment_verified"]["status"] == "VERIFIED"

    second = worker.run_once()
    assert second is not None and second.status == "verified"
    assert job.state == "TENANT_CREATED"
    assert any(e.event_type == "RECOVERY_VERIFIED" for e in store.events)
    assert any(e.event_type == "RECOVERY_RESUME" for e in store.events)
    print("RECOVERY_RUNTIME_SMOKE: PASS")

if __name__ == "__main__":
    smoke()
