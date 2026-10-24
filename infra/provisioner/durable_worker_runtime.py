"""Durable worker boundary for PostgreSQL-backed Provisioner jobs."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping
from postgres_job_queue import PostgresJobQueue
from postgres_job_store import PostgresJobStore
from worker_runtime import ProvisionerWorker

class DurableProvisionerWorker:
    """Claims a PostgreSQL lease exactly once, then processes that job directly."""
    def __init__(self, store: PostgresJobStore, queue: PostgresJobQueue, worker_id: str, implementations: Mapping[str, Any], registry: Mapping[str, Any]):
        self.store, self.queue, self.worker_id = store, queue, worker_id
        self.worker = ProvisionerWorker(store, queue, implementations, registry)

    def run_once(self) -> bool:
        claimed = self.queue.claim(self.worker_id)
        if claimed is None:
            self.queue.recover_expired()
            return False
        job, lease_id = claimed
        try:
            result = self.worker.process_job(job)
            if result.status == "verified":
                self.queue.enqueue(job)
                self.queue.complete(job.job_id, lease_id)
            elif result.status == "retry":
                retry_at = (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()
                self.queue.release(job.job_id, lease_id, retry_at, result.state)
            else:
                # accepted/terminal/blocked work has no successor queue item.
                self.queue.complete(job.job_id, lease_id)
            return True
        except Exception as exc:
            retry_at = (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()
            self.queue.release(job.job_id, lease_id, retry_at, type(exc).__name__)
            raise

if __name__ == "__main__":
    print("DURABLE_WORKER_RUNTIME_MODULE: PASS")
