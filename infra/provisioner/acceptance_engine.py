"""Independent acceptance for durable Provisioner jobs."""
from __future__ import annotations
from dataclasses import dataclass
from typing import Any, Mapping, Protocol
from job_store import StoredJob, utc_now

OPERATIONAL_STATES = ("PAYMENT_VERIFIED", "TENANT_CREATED", "DOMAIN_READY", "DNS_READY", "SITE_READY", "TLS_READY", "MAIL_READY", "INTEGRATIONS_READY")

@dataclass(frozen=True)
class AcceptanceResult:
    status: str
    checks: tuple[str, ...]
    failures: tuple[str, ...] = ()
    evidence: dict[str, Any] | None = None

class AcceptanceProbe(Protocol):
    def check(self, job: StoredJob, state: str) -> bool: ...

class AcceptanceEngine:
    """The only component permitted to certify ACCEPTANCE_PASSED."""
    def __init__(self, probe: AcceptanceProbe):
        self.probe = probe

    def evaluate(self, job: StoredJob) -> AcceptanceResult:
        checks = tuple(f"acceptance.{state.lower()}" for state in OPERATIONAL_STATES)
        missing = tuple(state for state in OPERATIONAL_STATES if state not in job.evidence)
        if missing:
            return AcceptanceResult("BLOCKED", checks, missing)
        failures = tuple(state for state in OPERATIONAL_STATES if not self.probe.check(job, state))
        if failures:
            return AcceptanceResult("FAILED", checks, failures)
        evidence = {"evidence_id": f"accept_{job.job_id}", "observed_at": utc_now(), "verified": True, "checks": checks}
        return AcceptanceResult("PASSED", checks, evidence=evidence)

    def promote(self, job: StoredJob) -> AcceptanceResult:
        result = self.evaluate(job)
        if result.status != "PASSED":
            return result
        job.evidence["ACCEPTANCE_PASSED"] = result.evidence or {}
        job.state = "HANDOVER_READY"
        return result

class EvidenceAcceptanceProbe:
    """Provider-neutral default probe: verifies the adapter evidence envelope."""
    def check(self, job: StoredJob, state: str) -> bool:
        evidence = job.evidence.get(state)
        return isinstance(evidence, Mapping) and evidence.get("verified") is True

if __name__ == "__main__":
    from job_store import MemoryJobStore
    job = MemoryJobStore().create_or_get("t", "i", "j")[0]
    for state in OPERATIONAL_STATES:
        job.evidence[state] = {"verified": True}
    engine = AcceptanceEngine(EvidenceAcceptanceProbe())
    result = engine.promote(job)
    assert result.status == "PASSED" and job.state == "HANDOVER_READY"
    print("ACCEPTANCE_ENGINE_CANONICAL_SMOKE: PASS")
