"""Provider-neutral Provisioner job queue.

This queue is intentionally small: durable persistence belongs to JobStore,
while scheduling, retry/backoff, and fail-closed semantics belong here.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from job_store import JobStore, StoredJob, utc_now


@dataclass(frozen=True)
class QueueItem:
    job_id: str
    available_at: str
    attempt: int


class JobQueue:
    MAX_ATTEMPTS = 5
    BASE_BACKOFF_SECONDS = 5

    def __init__(self, store: JobStore) -> None:
        self.store = store
        self._items: List[QueueItem] = []

    def enqueue(self, job: StoredJob) -> None:
        if job.state in {"HANDOVER_READY", "BLOCKED"}:
            return
        available = job.next_attempt_at or utc_now()
        self._items.append(QueueItem(job.job_id, available, job.attempts))

    def claim_next(self, now: Optional[datetime] = None) -> Optional[StoredJob]:
        now = now or datetime.now(timezone.utc)
        for index, item in enumerate(self._items):
            available = datetime.fromisoformat(item.available_at)
            if available <= now:
                self._items.pop(index)
                job = self.store.get(item.job_id)
                if job is None or job.state in {"HANDOVER_READY", "BLOCKED"}:
                    continue
                return job
        return None

    def retry(self, job: StoredJob, retryable: bool, error_code: str) -> None:
        if not retryable or job.attempts >= self.MAX_ATTEMPTS:
            job.state = "BLOCKED"
            job.next_attempt_at = None
            self.store.save(job)
            return

        delay = self.BASE_BACKOFF_SECONDS * (2 ** max(job.attempts - 1, 0))
        due = datetime.now(timezone.utc) + timedelta(seconds=delay)
        job.next_attempt_at = due.isoformat()
        self.store.save(job)
        self._items.append(QueueItem(job.job_id, job.next_attempt_at, job.attempts))

    def pending(self) -> int:
        return len(self._items)


def smoke() -> None:
    from job_store import MemoryJobStore

    store = MemoryJobStore()
    job, _ = store.create_or_get("tenant-1", "key-1", "job-1")
    queue = JobQueue(store)
    queue.enqueue(job)
    claimed = queue.claim_next()
    assert claimed is job
    claimed.attempts = 1
    queue.retry(claimed, retryable=True, error_code="TRANSIENT")
    assert queue.pending() == 1
    claimed.state = "BLOCKED"
    queue.retry(claimed, retryable=True, error_code="PERMANENT")
    assert claimed.state == "BLOCKED"
    assert queue.pending() == 1  # stale scheduled item is discarded when claimed
    print("PROVISIONER_JOB_QUEUE_SMOKE: PASS")


if __name__ == "__main__":
    smoke()
