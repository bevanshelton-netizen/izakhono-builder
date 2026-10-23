#!/usr/bin/env python3
"""IZAKHONO PROVISIONER v1 reference state machine.

No external dependencies and no provider credentials. Provider adapters are
intentionally represented by opaque step results so the orchestration layer
can remain portable across owned infrastructure and reversible fallbacks.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from hashlib import sha256
from time import time
from typing import Any


class State(str, Enum):
    PAYMENT_VERIFIED = "PAYMENT_VERIFIED"
    TENANT_CREATED = "TENANT_CREATED"
    DOMAIN_READY = "DOMAIN_READY"
    DNS_READY = "DNS_READY"
    SITE_READY = "SITE_READY"
    TLS_READY = "TLS_READY"
    MAIL_READY = "MAIL_READY"
    INTEGRATIONS_READY = "INTEGRATIONS_READY"
    ACCEPTANCE_PASSED = "ACCEPTANCE_PASSED"
    HANDOVER_READY = "HANDOVER_READY"
    BLOCKED = "BLOCKED"


PIPELINE = [
    State.PAYMENT_VERIFIED,
    State.TENANT_CREATED,
    State.DOMAIN_READY,
    State.DNS_READY,
    State.SITE_READY,
    State.TLS_READY,
    State.MAIL_READY,
    State.INTEGRATIONS_READY,
    State.ACCEPTANCE_PASSED,
    State.HANDOVER_READY,
]


@dataclass(frozen=True)
class StepResult:
    ok: bool
    evidence: dict[str, Any] = field(default_factory=dict)
    retryable: bool = False
    error_code: str | None = None


@dataclass
class ProvisioningJob:
    job_id: str
    tenant_id: str
    idempotency_key: str
    state: State = State.PAYMENT_VERIFIED
    attempts: dict[str, int] = field(default_factory=dict)
    evidence: dict[str, dict[str, Any]] = field(default_factory=dict)
    audit: list[dict[str, Any]] = field(default_factory=list)

    def record(self, event: str, **payload: Any) -> None:
        self.audit.append({"ts": time(), "event": event, **payload})

    def next_state(self) -> State | None:
        if self.state in (State.BLOCKED, State.HANDOVER_READY):
            return None
        index = PIPELINE.index(self.state)
        return PIPELINE[index + 1] if index + 1 < len(PIPELINE) else None


class Provisioner:
    """Durable-state-machine contract; persistence is injected by the caller."""

    MAX_ATTEMPTS = 5

    def __init__(self) -> None:
        self.jobs: dict[str, ProvisioningJob] = {}
        self.idempotency: dict[str, str] = {}

    @staticmethod
    def make_job_id(tenant_id: str, idempotency_key: str) -> str:
        digest = sha256(f"{tenant_id}:{idempotency_key}".encode()).hexdigest()[:24]
        return f"prov_{digest}"

    def create(self, tenant_id: str, idempotency_key: str) -> ProvisioningJob:
        if not tenant_id or not idempotency_key:
            raise ValueError("tenant_id and idempotency_key are required")
        existing = self.idempotency.get(idempotency_key)
        if existing:
            return self.jobs[existing]
        job_id = self.make_job_id(tenant_id, idempotency_key)
        job = ProvisioningJob(job_id, tenant_id, idempotency_key)
        job.record("JOB_CREATED", tenant_id=tenant_id)
        self.jobs[job_id] = job
        self.idempotency[idempotency_key] = job_id
        return job

    def apply(self, job: ProvisioningJob, result: StepResult) -> ProvisioningJob:
        if job.state in (State.BLOCKED, State.HANDOVER_READY):
            return job

        current = job.state.value
        job.attempts[current] = job.attempts.get(current, 0) + 1
        if result.ok:
            job.evidence[current] = dict(result.evidence)
            next_state = job.next_state()
            job.record("STEP_PASSED", state=current, evidence=result.evidence)
            if next_state is not None:
                job.state = next_state
                job.record("STATE_CHANGED", state=next_state.value)
            return job

        job.record("STEP_FAILED", state=current, error_code=result.error_code, retryable=result.retryable)
        if result.retryable and job.attempts[current] < self.MAX_ATTEMPTS:
            return job
        job.state = State.BLOCKED
        job.record("JOB_BLOCKED", failed_state=current)
        return job

    def handover(self, job: ProvisioningJob) -> dict[str, Any]:
        if job.state != State.HANDOVER_READY:
            raise RuntimeError("handover requires HANDOVER_READY")
        required = [s.value for s in PIPELINE[:-1]]
        missing = [s for s in required if s not in job.evidence]
        if missing:
            raise RuntimeError(f"missing acceptance evidence: {missing}")
        # Never copy secrets from provider results into the customer record.
        return {
            "job_id": job.job_id,
            "tenant_id": job.tenant_id,
            "status": "HANDOVER_READY",
            "evidence_states": required,
            "generated_at": time(),
        }


def demo() -> None:
    p = Provisioner()
    job = p.create("tenant-demo", "order-001")
    for state in PIPELINE[:-1]:
        if job.state != state:
            raise AssertionError((job.state, state))
        p.apply(job, StepResult(True, {"gate": state.value, "verified": True}))
    assert job.state == State.HANDOVER_READY
    record = p.handover(job)
    assert record["status"] == "HANDOVER_READY"
    print("PROVISIONER_SMOKE: PASS")


if __name__ == "__main__":
    demo()
