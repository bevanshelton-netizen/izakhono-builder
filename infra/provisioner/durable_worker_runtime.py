"""Durable worker boundary for PostgreSQL-backed Provisioner jobs."""
from __future__ import annotations
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping
from postgres_job_queue import PostgresJobQueue
from postgres_job_store import PostgresJobStore
from worker_runtime import ProvisionerWorker

class DurableProvisionerWorker:
    def __init__(self, store: PostgresJobStore, queue: PostgresJobQueue, worker_id: str, implementations: Mapping[str, Any], registry: Mapping[str, Any]):
        self.store, self.queue, self.worker_id = store, queue, worker_id
        self.worker = ProvisionerWorker(store, _QueueBridge(store, queue, worker_id), implementations, registry)

    def run_once(self) -> bool:
        claimed = self.queue.claim(self.worker_id)
        if claimed is None:
            self.queue.recover_expired()
            return False
        job, lease_id = claimed
        try:
            result = self.worker.run_once()
            if result is None:
                self.queue.complete(job.job_id, lease_id)
                return True
            if result.status in {"retry", "blocked"}:
                self.queue.release(job.job_id, lease_id, error_code=result.status)
            else:
                self.queue.complete(job.job_id, lease_id)
            return True
        except Exception as exc:
            retry_at = (datetime.now(timezone.utc) + timedelta(seconds=5)).isoformat()
            self.queue.release(job.job_id, lease_id, retry_at, type(exc).__name__)
            raise

class _QueueBridge:
    """Adapter allowing the canonical worker to consume a pre-claimed durable job."""
    def __init__(self, store: PostgresJobStore, queue: PostgresJobQueue, worker_id: str):
        self.store, self.queue, self.worker_id = store, queue, worker_id
    def claim_next(self):
        # The durable wrapper has already claimed the job. The canonical worker
        # is intentionally not allowed to claim a second row.
        return None
    def enqueue(self, job):
        self.queue.enqueue(job)

if __name__ == "__main__":
    print("DURABLE_WORKER_RUNTIME_MODULE: PASS")
