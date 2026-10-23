"""Canonical import-safe Provisioner job store.

The hyphenated job-store.py remains as the historical artifact; this module is
used by executable service code because Python module imports require identifiers.
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
    def create_or_get(self, tenant_id: str, idempotency_key: str, job_id: str) -> Tuple[StoredJob, bool]: raise NotImplementedError
    def get(self, job_id: str) -> Optional[StoredJob]: raise NotImplementedError
    def save(self, job: StoredJob) -> None: raise NotImplementedError
    def append_audit(self, event: AuditEvent) -> None: raise NotImplementedError

class MemoryJobStore(JobStore):
    def __init__(self) -> None:
        self._jobs: Dict[str, StoredJob] = {}
        self._idempotency: Dict[Tuple[str, str], str] = {}
        self._events: List[AuditEvent] = []
    def create_or_get(self, tenant_id: str, idempotency_key: str, job_id: str) -> Tuple[StoredJob, bool]:
        key = (tenant_id, idempotency_key)
        if key in self._idempotency: return self._jobs[self._idempotency[key]], False
        job = StoredJob(job_id, tenant_id, idempotency_key)
        self._jobs[job_id] = job; self._idempotency[key] = job_id
        return job, True
    def get(self, job_id: str) -> Optional[StoredJob]: return self._jobs.get(job_id)
    def save(self, job: StoredJob) -> None: self._jobs[job.job_id] = job
    def append_audit(self, event: AuditEvent) -> None:
        self._events.append(event)
        if event.job_id in self._jobs: self._jobs[event.job_id].audit.append(event)
    @property
    def events(self) -> List[AuditEvent]: return list(self._events)
