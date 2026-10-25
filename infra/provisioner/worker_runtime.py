from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Mapping

from acceptance_engine import AcceptanceEngine, AcceptanceResult, EvidenceAcceptanceProbe
from adapter_catalog import CAPABILITY_TO_ADAPTER, build_catalog
from adapter_executor import AdapterExecutor
from execution_contract import ExecutionResult, validate_result
from job_queue import JobQueue
from job_store import AuditEvent, StoredJob, utc_now
from state_machine import State

STATE_CAPABILITY = {
    State.PAYMENT_VERIFIED.value: "tenant",
    State.TENANT_CREATED.value: "domain",
    State.DOMAIN_READY.value: "dns",
    State.DNS_READY.value: "site",
    State.SITE_READY.value: "tls",
    State.TLS_READY.value: "mail",
    State.MAIL_READY.value: "crm_whatsapp",
    State.INTEGRATIONS_READY.value: "acceptance",
}


@dataclass(frozen=True)
class WorkerResult:
    job_id: str
    state: str
    status: str
    message: str = ""


class ProvisionerWorker:
    def __init__(self, store, queue: JobQueue, implementations: Mapping[str, Callable[..., Any]] | Any,
                 registry: Mapping[str, Any], acceptance: AcceptanceEngine | None = None,
                 recovery_store=None, recovery_executors=None):
        self.store = store
        self.queue = queue
        self.implementations = implementations
        self.registry = registry
        # Always provide a real acceptance probe for the default path. Custom engines
        # remain supported for production/provider-specific acceptance implementations.
        self.acceptance = acceptance or AcceptanceEngine(EvidenceAcceptanceProbe())
        self.recovery = None
        if recovery_store is not None:
            from recovery_orchestrator import RecoveryOrchestrator
            self.recovery = RecoveryOrchestrator(recovery_store, recovery_executors or {})

    def _executor(self) -> AdapterExecutor:
        return AdapterExecutor(self.registry, self.implementations)

    def _request(self, job: StoredJob, capability: str, operation: str, operation_id: str) -> dict[str, Any]:
        return {
            "operation_id": operation_id,
            "tenant_id": job.tenant_id,
            "capability": capability,
            "idempotency_key": job.idempotency_key,
            "desired_state": dict(job.evidence.get("desired_state", {})),
            "execution_key": f"{job.tenant_id}:{operation}:{job.idempotency_key}:{capability}",
        }

    def _block(self, job: StoredJob, code: str, message: str = "") -> WorkerResult:
        job.state = State.BLOCKED.value
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_blocked", job.job_id, "BLOCKED", job.state, utc_now(),
                                           {"error_code": code, "message": message}))
        return WorkerResult(job.job_id, job.state, "blocked", message)

    def _failure(self, job: StoredJob, code: str, message: str, operation_id: str) -> WorkerResult:
        job.attempts += 1
        if self.recovery is not None:
            recovered = self.recovery.recover(job, job.state, operation_id, message)
            if not recovered.ok:
                return self._block(job, "RECOVERY_FAILED", recovered.reason)
            self.store.append_audit(AuditEvent(f"evt_{job.job_id}_recovery_resume_{job.attempts}", job.job_id,
                                               "RECOVERY_RESUME", job.state, utc_now(),
                                               {"operation_id": operation_id, "recovery_id": recovered.recovery_id,
                                                "action": recovered.action}))
        if job.attempts >= 5:
            return self._block(job, code, message)
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_retry_{job.attempts}", job.job_id, "RETRY_SCHEDULED", job.state,
                                           utc_now(), {"error_code": code, "recovery": self.recovery is not None}))
        return WorkerResult(job.job_id, job.state, "retry", message)

    def _accept(self, job: StoredJob) -> WorkerResult:
        result: AcceptanceResult = self.acceptance.promote(job)
        if result.status == "PASSED":
            self.store.save(job)
            self.store.append_audit(AuditEvent(f"evt_{job.job_id}_accepted", job.job_id, "ACCEPTANCE_PASSED", job.state,
                                               utc_now(), {"checks": result.checks}))
            return WorkerResult(job.job_id, job.state, "accepted")
        return self._block(job, "ACCEPTANCE_EVIDENCE_MISSING" if result.status == "BLOCKED" else "ACCEPTANCE_FAILED",
                           ",".join(result.failures))

    def process_job(self, job: StoredJob) -> WorkerResult:
        if job.state in {State.HANDOVER_READY.value, State.BLOCKED.value}:
            return WorkerResult(job.job_id, job.state, "terminal")
        if job.state == State.ACCEPTANCE_PASSED.value:
            return self._accept(job)
        capability = STATE_CAPABILITY.get(job.state)
        if capability is None:
            return self._block(job, "STATE_UNSUPPORTED", job.state)
        operation = self.registry.get("bindings", {}).get(capability, {}).get("operation", capability)
        operation_id = f"op_{job.job_id}_{job.attempts + 1}_{capability}"
        try:
            result = self._executor().execute(self._request(job, capability, operation, operation_id))
            validate_result(result)
        except Exception as exc:
            return self._failure(job, "ADAPTER_EXECUTION_FAILED", str(exc), operation_id)
        next_state = {
            "tenant": State.TENANT_CREATED.value,
            "domain": State.DOMAIN_READY.value,
            "dns": State.DNS_READY.value,
            "site": State.SITE_READY.value,
            "tls": State.TLS_READY.value,
            "mail": State.MAIL_READY.value,
            "crm_whatsapp": State.INTEGRATIONS_READY.value,
            "acceptance": State.ACCEPTANCE_PASSED.value,
        }[capability]
        job.state = next_state
        job.evidence[next_state] = dict(result.evidence)
        self.store.save(job)
        self.store.append_audit(AuditEvent(f"evt_{job.job_id}_{job.attempts}", job.job_id, "STATE_CHANGED", job.state,
                                           utc_now(), {"capability": capability, "operation": operation,
                                                       "operation_id": operation_id, "adapter": result.adapter,
                                                       "ownership": result.ownership}))
        return WorkerResult(job.job_id, job.state, "verified")

    def run_once(self) -> WorkerResult | None:
        item = self.queue.claim_next()
        if item is None:
            return None
        job = self.store.get(item.job_id)
        if job is None:
            return None
        result = self.process_job(job)
        if result.status in {"verified", "accepted", "blocked", "terminal"}:
            self.queue.complete(item.lease_id)
        else:
            self.queue.release(item.lease_id, retry_at=utc_now())
        return result

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
    results = [worker.run_once() for _ in range(10)]
    assert any(r is not None and r.status == "accepted" for r in results) and job.state == State.HANDOVER_READY.value
    assert all(r is not None for r in results[:8])
    assert set(job.evidence) == {"PAYMENT_VERIFIED", "TENANT_CREATED", "DOMAIN_READY", "DNS_READY", "SITE_READY", "TLS_READY", "MAIL_READY", "INTEGRATIONS_READY", "ACCEPTANCE_PASSED"}
    print("PROVISIONER_WORKER_RUNTIME: PASS")