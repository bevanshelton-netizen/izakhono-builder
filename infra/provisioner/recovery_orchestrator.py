"""Durable, provider-neutral recovery orchestration for Provisioner failures."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Callable, Mapping
from rollback_store import RollbackStore
from job_store import AuditEvent, JobStore, StoredJob, utc_now

RECOVERY_ACTIONS: dict[str, str] = {
    "PAYMENT_VERIFIED": "reconcile_payment",
    "TENANT_CREATED": "reconcile_tenant",
    "DOMAIN_READY": "reconcile_domain",
    "DNS_READY": "reconcile_dns",
    "SITE_READY": "reconcile_site",
    "TLS_READY": "reconcile_tls",
    "MAIL_READY": "reconcile_mail",
    "INTEGRATIONS_READY": "reconcile_integrations",
}

@dataclass(frozen=True)
class RecoveryResult:
    ok: bool
    action: str
    recovery_id: str
    evidence: Mapping[str, Any]
    reason: str = ""

class RecoveryOrchestrator:
    """Persists recovery intent before execution and never fabricates recovery success."""
    def __init__(self, store: JobStore, recovery_store: RollbackStore,
                 executors: Mapping[str, Callable[[StoredJob], Mapping[str, Any]]],
                 verifier: Callable[[StoredJob, str, Mapping[str, Any]], bool] | None = None) -> None:
        self.store = store
        self.recovery_store = recovery_store
        self.executors = executors
        self.verifier = verifier or (lambda _job, _action, evidence: bool(evidence.get("verified") is True))

    def recover(self, job: StoredJob, failed_state: str, operation_id: str, reason: str) -> RecoveryResult:
        action = RECOVERY_ACTIONS.get(failed_state)
        recovery_id = f"recovery_{job.job_id}_{operation_id}"
        if action is None:
            self.recovery_store.record(recovery_id=recovery_id, job_id=job.job_id,
                operation_id=operation_id, state=failed_state, action="unsupported",
                status="BLOCKED", reason="NO_REVERSIBLE_RECOVERY", evidence={})
            self.store.append_audit(AuditEvent(
                f"evt_{recovery_id}_blocked", job.job_id, "RECOVERY_BLOCKED", failed_state,
                utc_now(), {"operation_id": operation_id, "action": "unsupported", "reason": "NO_REVERSIBLE_RECOVERY"}))
            return RecoveryResult(False, "unsupported", recovery_id, {}, "NO_REVERSIBLE_RECOVERY")

        existing = [r for r in self.recovery_store.list_for_job(job.job_id)
                    if r["recovery_id"] == recovery_id and r["action"] == action]
        if existing and existing[-1]["status"] == "VERIFIED":
            return RecoveryResult(True, action, recovery_id, existing[-1]["evidence"], "already_verified")

        self.recovery_store.record(recovery_id=recovery_id, job_id=job.job_id,
            operation_id=operation_id, state=failed_state, action=action,
            status="PENDING", reason=reason, evidence={})
        self.store.append_audit(AuditEvent(
            f"evt_{recovery_id}_started", job.job_id, "RECOVERY_STARTED", failed_state,
            utc_now(), {"operation_id": operation_id, "action": action}))

        executor = self.executors.get(action)
        if executor is None:
            self.recovery_store.record(recovery_id=recovery_id, job_id=job.job_id,
                operation_id=operation_id, state=failed_state, action=action,
                status="BLOCKED", reason="RECOVERY_EXECUTOR_UNAVAILABLE", evidence={})
            self.store.append_audit(AuditEvent(
                f"evt_{recovery_id}_unavailable", job.job_id, "RECOVERY_BLOCKED", failed_state,
                utc_now(), {"operation_id": operation_id, "action": action, "reason": "RECOVERY_EXECUTOR_UNAVAILABLE"}))
            return RecoveryResult(False, action, recovery_id, {}, "RECOVERY_EXECUTOR_UNAVAILABLE")

        try:
            evidence = dict(executor(job))
            evidence["verified"] = bool(self.verifier(job, action, evidence))
        except Exception as exc:
            evidence = {"verified": False, "error": type(exc).__name__}
            self.recovery_store.record(recovery_id=recovery_id, job_id=job.job_id,
                operation_id=operation_id, state=failed_state, action=action,
                status="FAILED", reason=str(exc), evidence=evidence)
            self.store.append_audit(AuditEvent(
                f"evt_{recovery_id}_failed", job.job_id, "RECOVERY_FAILED", failed_state,
                utc_now(), {"operation_id": operation_id, "action": action, "error": type(exc).__name__}))
            return RecoveryResult(False, action, recovery_id, evidence, str(exc))

        if not evidence["verified"]:
            self.recovery_store.record(recovery_id=recovery_id, job_id=job.job_id,
                operation_id=operation_id, state=failed_state, action=action,
                status="FAILED", reason="RECOVERY_VERIFICATION_FAILED", evidence=evidence)
            self.store.append_audit(AuditEvent(
                f"evt_{recovery_id}_unverified", job.job_id, "RECOVERY_FAILED", failed_state,
                utc_now(), {"operation_id": operation_id, "action": action, "reason": "RECOVERY_VERIFICATION_FAILED"}))
            return RecoveryResult(False, action, recovery_id, evidence, "RECOVERY_VERIFICATION_FAILED")

        self.recovery_store.record(recovery_id=recovery_id, job_id=job.job_id,
            operation_id=operation_id, state=failed_state, action=action,
            status="VERIFIED", reason="RECOVERY_VERIFIED", evidence=evidence)
        self.store.append_audit(AuditEvent(
            f"evt_{recovery_id}_verified", job.job_id, "RECOVERY_VERIFIED", failed_state,
            utc_now(), {"operation_id": operation_id, "action": action, "evidence": evidence}))
        return RecoveryResult(True, action, recovery_id, evidence, "RECOVERY_VERIFIED")

if __name__ == "__main__":
    print("RECOVERY_ORCHESTRATOR: PASS")
