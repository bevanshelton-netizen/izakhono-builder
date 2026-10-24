"""Unified Provisioner worker: registry -> binding -> execution -> evidence -> acceptance -> recovery."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from adapter_executor import AdapterExecutor
from adapter_registry_runtime import load_registry
from acceptance_engine import AcceptanceEngine, AcceptanceResult, EvidenceAcceptanceProbe
from adapter_catalog import CAPABILITY_TO_ADAPTER, build_catalog
from execution_contract import validate_request, validate_result
from job_store import AuditEvent, JobStore, StoredJob, utc_now
from job_queue import JobQueue
from recovery_orchestrator import RecoveryOrchestrator
from rollback_store import RollbackStore
from state_machine import PIPELINE, State

STATE_CAPABILITY = {
    State.PAYMENT_VERIFIED.value: "tenant",
    State.TENANT_CREATED.value: "domain",
    State.DOMAIN_READY.value: "dns",
    State.DNS_READY.value: "site",
    State.SITE_READY.value: "tls",
    State.TLS_READY.value: "mail",
    State.MAIL_READY.value: "crm_whatsapp",
}

@dataclass(frozen=True)
class WorkerResult:
    job_id: str
    state: str
    status: str

class ProvisionerWorker:
    """Canonical execution engine with queue ownership outside process_job()."""
    def __init__(self, store: JobStore, queue: JobQueue,
                 implementations: Mapping[str, Callable[[Mapping[str, Any]], Mapping[str, Any]]],
                 registry: Mapping[str, Any] | None = None,
                 recovery_store: RollbackStore | None = None,
                 recovery_executors: Mapping[str, Callable[[StoredJob], Mapping[str, Any]]] | None = None):
        self.store, self.queue = store, queue
        self.registry = registry or load_registry()
        self.executor = AdapterExecutor(self.registry, implementations)
        self.acceptance = AcceptanceEngine(EvidenceAcceptanceProbe())
        self.recovery = (RecoveryOrchestrator(store, recovery_store, recovery_executors or {})
                         if recovery_store is not None else None)

    def _binding(self, capability: str) -> Mapping[str, Any]:
        return self.registry.get("bindings", {}).get(capability, {})

    def run_once(self) -> WorkerResult | None:
        job = self.queue.claim_next()
        if job is None:
            return None
        result = self.process_job(job)
        if result.status == "verified":
            self.queue.enqueue(job)
        elif result.status == "retry":
            self.queue.retry(job, True, result.state)
        return result

    def process_job(self, job: StoredJob) -> WorkerResult:
        """Process one already-owned job without claiming it from a queue."""
        if job.state in {State.HANDOVER_READY.value, State.BLOCKED.value}:
            return WorkerResult(job.job_id, job.state, "terminal")
        if job.state == State.INTEGRATIONS_READY.value:
            return self._accept(job)
        capability = STATE_CAPABILITY.get(job.state)
        if capability is None:
            return self._block(job, "UNSUPPORTED_STATE")
        binding = self._binding(capability)
        operation = str(binding.get("operation") or f"advance_{job.state.lower()}")
        operation_id = f"op_{job.job_id}_{job.state.lower()}"
        request = {"operation_id": operation_id, "tenant_id": job.tenant_id, "capability": capability, "idempotency_key": job.idempotency_key}
        try:
            validate_request(request)
            result = self.executor.execute(operation_id=operation_id, tenant_id=job.tenant_id, capability=capability,
                                           desired_state={"state": job.state, "operation": operation},
                                           idempotency_key=job.idempotency_key)
            envelope = {"operation_id": result.operation_id, "capability": result.capability, "adapter": result.adapter,
                        "ownership": result.ownership, "status": "verified", "evidence": result.evidence}
            validate_result(envelope, request)
        except Exception as exc:
            return self._failure(job, getattr(exc, "code", "WORKER_EXECUTION_FAILED"), str(exc), operation_id)
        current = job.state
        job.attempts += 1
        next_state = PIPELINE[PIPELINE.index(State(current)) + 1].value
        if next_state != State.PAYMENT_VERIFIED.value:
            job.evidence[next_state] = dict(result.evidence)
        job.state = next_state
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_{job.attempts}", job.job_id, "STATE_CHANGED", job.state,
                                           utc_now(), {"capability": capability, "operation": operation,
                                                       "operation_id": operation_id, "adapter": result.adapter,
                                                       "ownership": result.ownership}))
        return WorkerResult(job.job_id, job.state, "verified")

    def _accept(self, job: StoredJob) -> WorkerResult:
        result: AcceptanceResult = self.acceptance.promote(job)
        if result.status == "PASSED":
            self.store.save(job)
            self.store.append_audit(AuditEvent(f"evt_{job.job_id}_accepted", job.job_id, "ACCEPTANCE_PASSED", job.state,
                                               utc_now(), {"checks": result.checks}))
            return WorkerResult(job.job_id, job.state, "accepted")
        return self._block(job, "ACCEPTANCE_EVIDENCE_MISSING" if result.status == "BLOCKED" else "ACCEPTANCE_FAILED",
                           ",".join(result.failures))

    def _failure(self, job: StoredJob, code: str, message: str, operation_id: str) -> WorkerResult:
        job.attempts += 1
        if self.recovery is not None:
            recovered = self.recovery.recover(job, job.state, operation_id, message)
            if recovered.ok:
                self.store.append_audit(AuditEvent(f"evt_{job.job_id}_recovery_resume_{job.attempts}", job.job_id,
                                                   "RECOVERY_RESUME", job.state, utc_now(),
                                                   {"operation_id": operation_id, "recovery_id": recovered.recovery_id,
                                                    "action": recovered.action}))
            else:
                return self._block(job, "RECOVERY_FAILED", recovered.reason)
        if job.attempts >= 5:
            return self._block(job, code, message)
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_retry_{job.attempts}", job.job_id, "RETRY_SCHEDULED", job.state,
                                           utc_now(), {"error_code": code, "recovery": self.recovery is not None}))
        return WorkerResult(job.job_id, job.state, "retry")

    def _block(self, job: StoredJob, code: str, message: str = "") -> WorkerResult:
        job.state = State.BLOCKED.value
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_blocked", job.job_id, "BLOCKED", job.state, utc_now(),
                                           {"error_code": code, "message": message}))
        return WorkerResult(job.job_id, job.state, "blocked")

if __name__ == "__main__":
    from job_store import MemoryJobStore
    store = MemoryJobStore(); queue = JobQueue(store)
    registry = {"adapters": {k: {"owned": v} for k, v in CAPABILITY_TO_ADAPTER.items()},
                "bindings": {name: {"operation": "smoke"} for name in STATE_CAPABILITY.values()}}
    implementations = build_catalog()
    job, _ = store.create_or_get("tenant-demo", "idem-demo", "prov-demo")
    job.evidence["PAYMENT_VERIFIED"] = {"evidence_id": "pay-demo", "observed_at": utc_now(), "verified": True, "checks": ["payment.verified"]}
    store.save(job); queue.enqueue(job)
    worker = ProvisionerWorker(store, queue, implementations, registry)
    results = [worker.run_once() for _ in range(8)]
    assert results[-1] is not None and results[-1].status == "accepted" and job.state == State.HANDOVER_READY.value
    assert all(r is not None for r in results[:7])
    assert set(job.evidence) == {"PAYMENT_VERIFIED", "TENANT_CREATED", "DOMAIN_READY", "DNS_READY", "SITE_READY", "TLS_READY", "MAIL_READY", "INTEGRATIONS_READY", "ACCEPTANCE_PASSED"}
    print("PROVISIONER_WORKER_RUNTIME: PASS")
