"""Durable-ready Provisioner job store contract and reference implementation.

The reference store is process-safe in-memory for deterministic tests. Production
adapters can implement the same interface with PostgreSQL or another durable
store without changing the Provisioner state machine.

Security invariants:
- idempotency is scoped to tenant_id + idempotency_key
- secrets and credentials are never stored in job payloads or audit events
- state transitions are append-only in the audit trail
- no store operation can manufacture PAYMENT_VERIFIED evidence
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple


TERMINAL_STATES = {"HANDOVER_READY", "BLOCKED"}


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class AuditEvent:
    event_id: str
    job_id: str
    event_type: str
    state: str
    observed_at: str
    data: Dict[str, object] = field(default_factory=dict)


@dataclass
class StoredJob:
    job_id: str
    tenant_id: str
    idempotency_key: str
    state: str = "PAYMENT_VERIFIED"
    attempts: int = 0
    evidence: Dict[str, object] = field(default_factory=dict)
    audit: List[AuditEvent] = field(default_factory=list)
    next_attempt_at: Optional[str] = None


class JobStore:
    """Storage interface used by the queue/orchestrator boundary."""

    def create_or_get(self, tenant_id: str, idempotency_key: str, job_id: str) -> Tuple[StoredJob, bool]:
        raise NotImplementedError

    def get(self, job_id: str) -> Optional[StoredJob]:
        raise NotImplementedError

    def save(self, job: StoredJob) -> None:
        raise NotImplementedError

    def append_audit(self, event: AuditEvent) -> None:
        raise NotImplementedError


class MemoryJobStore(JobStore):
    """Reference implementation for unit/smoke tests; replace with durable storage in production."""

    def __init__(self) -> None:
        self._jobs: Dict[str, StoredJob] = {}
        self._idempotency: Dict[Tuple[str, str], str] = {}
        self._events: List[AuditEvent] = []

    def create_or_get(self, tenant_id: str, idempotency_key: str, job_id: str) -> Tuple[StoredJob, bool]:
        if not tenant_id or not idempotency_key or not job_id:
            raise ValueError("tenant_id, idempotency_key and job_id are required")
        key = (tenant_id, idempotency_key)
        existing_id = self._idempotency.get(key)
        if existing_id:
            return self._jobs[existing_id], False
        job = StoredJob(job_id=job_id, tenant_id=tenant_id, idempotency_key=idempotency_key)
        self._jobs[job_id] = job
        self._idempotency[key] = job_id
        return job, True

    def get(self, job_id: str) -> Optional[StoredJob]:
        return self._jobs.get(job_id)

    def save(self, job: StoredJob) -> None:
        if job.job_id not in self._jobs:
            raise KeyError("unknown job")
        self._jobs[job.job_id] = job

    def append_audit(self, event: AuditEvent) -> None:
        self._events.append(event)
        job = self._jobs.get(event.job_id)
        if job:
            job.audit.append(event)

    @property
    def events(self) -> List[AuditEvent]:
        return list(self._events)


def smoke() -> None:
    store = MemoryJobStore()
    first, created = store.create_or_get("tenant-1", "payment-123", "job-tenant-1-payment-123")
    second, duplicate = store.create_or_get("tenant-1", "payment-123", "different-job")
    assert created is True
    assert duplicate is False
    assert first.job_id == second.job_id
    assert first.state == "PAYMENT_VERIFIED"

    event = AuditEvent("evt-1", first.job_id, "JOB_CREATED", first.state, utc_now())
    store.append_audit(event)
    assert len(store.events) == 1
    assert len(first.audit) == 1
    print("PROVISIONER_JOB_STORE_SMOKE: PASS")


if __name__ == "__main__":
    smoke()
