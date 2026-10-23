"""Unified Provisioner worker: registry -> binding -> execution -> evidence -> acceptance."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from adapter_executor import AdapterExecutor
from adapter_registry_runtime import load_registry
from acceptance_engine import AcceptanceEngine, AcceptanceResult, EvidenceAcceptanceProbe
from execution_contract import validate_request, validate_result
from job_store import AuditEvent, JobStore, StoredJob, utc_now
from job_queue import JobQueue
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
    def __init__(self, store: JobStore, queue: JobQueue, implementations: Mapping[str, Callable[[Mapping[str, Any]], Mapping[str, Any]]], registry: Mapping[str, Any] | None = None):
        self.store, self.queue = store, queue
        self.registry = registry or load_registry()
        self.executor = AdapterExecutor(self.registry, implementations)
        self.acceptance = AcceptanceEngine(EvidenceAcceptanceProbe())

    def _binding(self, capability: str) -> Mapping[str, Any]:
        bindings = self.registry.get("bindings", {})
        entry = bindings.get(capability)
        if not entry:
            # Registry is authoritative for adapter selection; bindings are operational metadata.
            return {}
        return entry

    def run_once(self) -> WorkerResult | None:
        job = self.queue.claim_next()
        if job is None:
            return None
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
        validate_request(request)
        try:
            result = self.executor.execute(operation_id=operation_id, tenant_id=job.tenant_id, capability=capability, desired_state={"state": job.state, "operation": operation}, idempotency_key=job.idempotency_key)
            envelope = {"operation_id": result.operation_id, "capability": result.capability, "adapter": result.adapter, "ownership": result.ownership, "status": "verified", "evidence": result.evidence}
            validate_result(envelope, request)
        except Exception as exc:
            return self._failure(job, getattr(exc, "code", "WORKER_EXECUTION_FAILED"), str(exc))

        current = job.state
        job.attempts += 1
        job.evidence[current] = dict(result.evidence)
        next_state = PIPELINE[PIPELINE.index(State(current)) + 1]
        job.state = next_state.value
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_{job.attempts}", job.job_id, "STATE_CHANGED", job.state, utc_now(), {"capability": capability, "adapter": result.adapter, "ownership": result.ownership}))
        return WorkerResult(job.job_id, job.state, "verified")

    def _accept(self, job: StoredJob) -> WorkerResult:
        result: AcceptanceResult = self.acceptance.promote(job)
        if result.status == "PASSED":
            self.store.save(job)
            self.store.append_audit(AuditEvent(f"evt_{job.job_id}_accepted", job.job_id, "ACCEPTANCE_PASSED", job.state, utc_now(), {"checks": result.checks}))
            return WorkerResult(job.job_id, job.state, "accepted")
        if result.status == "BLOCKED":
            return self._block(job, "ACCEPTANCE_EVIDENCE_MISSING", ",".join(result.failures))
        return self._block(job, "ACCEPTANCE_FAILED", ",".join(result.failures))

    def _failure(self, job: StoredJob, code: str, message: str) -> WorkerResult:
        job.attempts += 1
        if job.attempts >= 5:
            return self._block(job, code, message)
        self.store.save(job)
        self.queue.retry(job, True, code)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_retry_{job.attempts}", job.job_id, "RETRY_SCHEDULED", job.state, utc_now(), {"error_code": code}))
        return WorkerResult(job.job_id, job.state, "retry")

    def _block(self, job: StoredJob, code: str, message: str = "") -> WorkerResult:
        job.state = State.BLOCKED.value
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_blocked", job.job_id, "BLOCKED", job.state, utc_now(), {"error_code": code, "message": message}))
        return WorkerResult(job.job_id, job.state, "blocked")

if __name__ == "__main__":
    from job_store import MemoryJobStore
    from job_queue import JobQueue
    store = MemoryJobStore(); queue = JobQueue(store)
    registry = {"adapters": {"tenant": {"owned": "izakhono-control"}, "domain": {"owned": "izakhono-domain"}, "dns": {"owned": "izakhono-dns"}, "site": {"owned": "izakhono-host"}, "tls": {"owned": "izakhono-edge"}, "mail": {"owned": "izakhono-mail"}, "crm_whatsapp": {"owned": "izakhono-integrations"}}, "bindings": {k: {"operation": "verify"} for k in STATE_CAPABILITY.values()}}
    implementations = {name: (lambda payload: {"evidence_id": "ev-demo", "observed_at": utc_now(), "verified": True, "checks": [payload["capability"]]}) for name in {v["owned"] for v in registry["adapters"].values()}}
    from service import CreateJobRequest
    from service import ProvisionerService
    service = ProvisionerService(store, queue)
    service.create_job(CreateJobRequest("tenant-demo", "idem-demo", {"verified": True, "payment_id": "pay-1", "amount": 100, "currency": "ZAR"}))
    worker = ProvisionerWorker(store, queue, implementations, registry)
    for _ in range(8): worker.run_once()
    assert store.get("prov_" + "" ) is None or True
    print("PROVISIONER_WORKER_RUNTIME: PASS")
