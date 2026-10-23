"""Canonical import-safe Provisioner queue with retry/backoff."""
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
    def __init__(self, store: JobStore) -> None: self.store, self._items = store, []
    def enqueue(self, job: StoredJob) -> None:
        if job.state in {"HANDOVER_READY", "BLOCKED"}: return
        self._items.append(QueueItem(job.job_id, job.next_attempt_at or utc_now(), job.attempts))
    def claim_next(self, now: Optional[datetime] = None) -> Optional[StoredJob]:
        now = now or datetime.now(timezone.utc)
        while self._items:
            item = self._items.pop(0)
            if datetime.fromisoformat(item.available_at) > now:
                self._items.insert(0, item); return None
            job = self.store.get(item.job_id)
            if job is not None and job.state not in {"HANDOVER_READY", "BLOCKED"}: return job
        return None
    def retry(self, job: StoredJob, retryable: bool, error_code: str) -> None:
        if not retryable or job.attempts >= self.MAX_ATTEMPTS:
            job.state = "BLOCKED"; job.next_attempt_at = None; self.store.save(job); return
        delay = self.BASE_BACKOFF_SECONDS * (2 ** max(job.attempts - 1, 0))
        job.next_attempt_at = (datetime.now(timezone.utc) + timedelta(seconds=delay)).isoformat()
        self.store.save(job); self._items.append(QueueItem(job.job_id, job.next_attempt_at, job.attempts))
    def pending(self) -> int: return len(self._items)
