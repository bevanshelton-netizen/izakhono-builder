#!/usr/bin/env python3
"""IZAKHONO Provisioner service boundary.

Dependency-light reference service. HTTP frameworks and durable databases can
wrap this service without changing its security or workflow semantics.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Dict, Optional

from job_queue import JobQueue
from job_store import AuditEvent, JobStore, StoredJob, utc_now
from state_machine import Provisioner, ProvisioningJob, State, StepResult


SECRET_FIELDS = {
    "password", "token", "api_key", "access_token", "refresh_token",
    "private_key", "client_secret", "secret",
}


class ServiceError(Exception):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def reject_secrets(value: Any, path: str = "payload") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in SECRET_FIELDS:
                raise ServiceError("SECRET_FIELD_REJECTED", f"secret field prohibited at {path}.{key}")
            reject_secrets(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_secrets(child, f"{path}[{index}]")


@dataclass(frozen=True)
class CreateJobRequest:
    tenant_id: str
    idempotency_key: str
    payment_evidence: Dict[str, Any]


class ProvisionerService:
    def __init__(self, store: JobStore, queue: JobQueue) -> None:
        self.store = store
        self.queue = queue
        self._handover: Dict[str, Dict[str, Any]] = {}

    def create_job(self, request: CreateJobRequest) -> Dict[str, Any]:
        reject_secrets({"payment_evidence": request.payment_evidence})
        evidence = request.payment_evidence
        if not request.tenant_id or not request.idempotency_key:
            raise ServiceError("INVALID_REQUEST", "tenant_id and idempotency_key are required")
        if evidence.get("verified") is not True:
            raise ServiceError("PAYMENT_NOT_VERIFIED", "verified payment evidence is required")
        for field in ("payment_id", "amount", "currency"):
            if not evidence.get(field):
                raise ServiceError("PAYMENT_EVIDENCE_INCOMPLETE", f"missing payment evidence: {field}")

        job_id = Provisioner.make_job_id(request.tenant_id, request.idempotency_key)
        job, created = self.store.create_or_get(request.tenant_id, request.idempotency_key, job_id)
        if created:
            job.evidence[State.PAYMENT_VERIFIED.value] = {
                "payment_id": evidence["payment_id"],
                "amount": evidence["amount"],
                "currency": evidence["currency"],
                "verified": True,
            }
            self.store.save(job)
            self.store.append_audit(AuditEvent(
                event_id=f"evt_{job.job_id}_created",
                job_id=job.job_id,
                event_type="JOB_CREATED",
                state=job.state,
                observed_at=utc_now(),
            ))
            self.queue.enqueue(job)
        return self.status(job.job_id, created=created)

    def status(self, job_id: str, created: Optional[bool] = None) -> Dict[str, Any]:
        job = self.store.get(job_id)
        if job is None:
            raise ServiceError("JOB_NOT_FOUND", "provisioning job not found")
        response = {
            "job_id": job.job_id,
            "tenant_id": job.tenant_id,
            "state": job.state,
            "attempts": job.attempts,
            "evidence": dict(job.evidence),
        }
        if created is not None:
            response["created"] = created
        return response

    def worker_once(self, executor: Callable[[StoredJob], StepResult]) -> Optional[Dict[str, Any]]:
        job = self.queue.claim_next()
        if job is None:
            return None
        if job.state in {"HANDOVER_READY", "BLOCKED"}:
            return self.status(job.job_id)

        current = job.state
        job.attempts += 1
        result = executor(job)
        if result.ok:
            job.evidence[current] = dict(result.evidence)
            next_state = self._next_state(current)
            if next_state:
                job.state = next_state
            self.store.save(job)
            self.store.append_audit(AuditEvent(
                event_id=f"evt_{job.job_id}_{job.attempts}",
                job_id=job.job_id,
                event_type="STATE_CHANGED",
                state=job.state,
                observed_at=utc_now(),
            ))
        else:
            self.store.save(job)
            self.queue.retry(job, result.retryable, result.error_code or "STEP_FAILED")
            self.store.append_audit(AuditEvent(
                event_id=f"evt_{job.job_id}_failure_{job.attempts}",
                job_id=job.job_id,
                event_type="RETRY_SCHEDULED" if result.retryable and job.state != "BLOCKED" else "BLOCKED",
                state=job.state,
                observed_at=utc_now(),
                data={"error_code": result.error_code},
            ))
        return self.status(job.job_id)

    @staticmethod
    def _next_state(state: str) -> Optional[str]:
        order = [s.value for s in __import__("state_machine").PIPELINE]
        if state not in order:
            raise ServiceError("INVALID_STATE", state)
        index = order.index(state)
        return order[index + 1] if index + 1 < len(order) else None

    def handover(self, job_id: str) -> Dict[str, Any]:
        job = self.store.get(job_id)
        if job is None:
            raise ServiceError("JOB_NOT_FOUND", "provisioning job not found")
        if job.state != State.HANDOVER_READY.value:
            raise ServiceError("HANDOVER_NOT_READY", "job is not ready for handover")
        required = [s.value for s in __import__("state_machine").PIPELINE[:-1]]
        missing = [state for state in required if state not in job.evidence]
        if missing:
            raise ServiceError("ACCEPTANCE_EVIDENCE_MISSING", str(missing))
        if job.evidence.get(State.ACCEPTANCE_PASSED.value, {}).get("verified") is not True:
            raise ServiceError("ACCEPTANCE_NOT_PASSED", "independent acceptance evidence required")
        record = {
            "job_id": job.job_id,
            "tenant_id": job.tenant_id,
            "status": "HANDOVER_READY",
            "evidence_states": required,
            "generated_at": utc_now(),
        }
        self._handover[job_id] = record
        self.store.append_audit(AuditEvent(
            event_id=f"evt_{job.job_id}_handover",
            job_id=job.job_id,
            event_type="HANDOVER_COMPLETED",
            state=job.state,
            observed_at=utc_now(),
        ))
        return record


def smoke() -> None:
    from job_store import MemoryJobStore

    store = MemoryJobStore()
    queue = JobQueue(store)
    service = ProvisionerService(store, queue)
    created = service.create_job(CreateJobRequest("tenant-1", "order-1", {
        "payment_id": "pay-1", "amount": 548, "currency": "ZAR", "verified": True
    }))
    assert created["created"] is True
    duplicate = service.create_job(CreateJobRequest("tenant-1", "order-1", {
        "payment_id": "pay-1", "amount": 548, "currency": "ZAR", "verified": True
    }))
    assert duplicate["created"] is False
    try:
        service.create_job(CreateJobRequest("tenant-1", "order-2", {
            "payment_id": "pay-2", "amount": 1, "currency": "ZAR", "verified": True, "token": "x"
        }))
    except ServiceError as exc:
        assert exc.code == "SECRET_FIELD_REJECTED"
    else:
        raise AssertionError("secret field was accepted")
    print("PROVISIONER_SERVICE_SMOKE: PASS")


if __name__ == "__main__":
    smoke()
