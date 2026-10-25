#!/usr/bin/env python3
"""IZAKHONO PROVISIONER acceptance engine v1.

Independent, provider-neutral acceptance gates. Adapter evidence is necessary
but simulation evidence can never satisfy production acceptance.
"""
from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from time import time
from typing import Any, Mapping, Protocol

from state_machine import PIPELINE, ProvisioningJob, State


class AcceptanceStatus(str, Enum):
    PASSED = "PASSED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


@dataclass(frozen=True)
class AcceptanceCheck:
    check_id: str
    state: State
    required: bool = True


@dataclass(frozen=True)
class CheckResult:
    check_id: str
    ok: bool
    evidence: Mapping[str, Any]
    error_code: str | None = None


class AcceptanceProbe(Protocol):
    def check(self, check: AcceptanceCheck, job: ProvisioningJob) -> CheckResult: ...


REQUIRED_CHECKS = tuple(
    AcceptanceCheck(f"acceptance.{state.value.lower()}", state)
    for state in PIPELINE[:-2]
)


def _is_production_evidence(evidence: Mapping[str, Any]) -> bool:
    """Simulation or explicit non-production evidence is never acceptable."""
    return bool(evidence.get("verified")) and not bool(evidence.get("simulation")) and not bool(evidence.get("live") is True and evidence.get("simulation"))


class AcceptanceEngine:
    """Certify a job only when every required state has independent production evidence."""

    def __init__(self, probe: AcceptanceProbe):
        self.probe = probe

    def evaluate(self, job: ProvisioningJob) -> AcceptanceStatus:
        job.record("ACCEPTANCE_STARTED", state=job.state.value)
        failures: list[str] = []
        missing: list[str] = []

        for check in REQUIRED_CHECKS:
            evidence = job.evidence.get(check.state.value)
            if evidence is None:
                missing.append(check.check_id)
                continue
            if not _is_production_evidence(evidence):
                job.record("ACCEPTANCE_CHECK", check_id=check.check_id, ok=False, error_code="SIMULATION_OR_UNVERIFIED_EVIDENCE")
                if check.required:
                    failures.append(check.check_id)
                continue
            result = self.probe.check(check, job)
            job.record("ACCEPTANCE_CHECK", check_id=check.check_id, ok=result.ok, error_code=result.error_code)
            if result.ok:
                job.evidence[check.state.value]["acceptance"] = dict(result.evidence)
            elif check.required:
                failures.append(check.check_id)

        if missing:
            job.record("ACCEPTANCE_BLOCKED", missing=missing)
            return AcceptanceStatus.BLOCKED
        if failures:
            job.record("ACCEPTANCE_FAILED", failures=failures)
            return AcceptanceStatus.FAILED

        job.evidence[State.ACCEPTANCE_PASSED.value] = {
            "accepted_at": time(),
            "checks": [c.check_id for c in REQUIRED_CHECKS],
            "verified": True,
            "simulation": False,
        }
        job.record("ACCEPTANCE_PASSED", checks=len(REQUIRED_CHECKS))
        return AcceptanceStatus.PASSED

    def promote(self, job: ProvisioningJob) -> ProvisioningJob:
        status = self.evaluate(job)
        if status != AcceptanceStatus.PASSED:
            raise RuntimeError(f"ACCEPTANCE_{status.value}")
        if job.state != State.ACCEPTANCE_PASSED:
            raise RuntimeError("ACCEPTANCE_REQUIRES_PIPELINE_STATE")
        job.state = State.HANDOVER_READY
        job.record("STATE_CHANGED", state=State.HANDOVER_READY.value)
        return job


def demo() -> None:
    class Probe:
        def check(self, check: AcceptanceCheck, job: ProvisioningJob) -> CheckResult:
            return CheckResult(check.check_id, True, {"probe": "verified"})

    from state_machine import PIPELINE, Provisioner, StepResult

    provisioner = Provisioner()
    job = provisioner.create("tenant-acceptance", "acceptance-001")
    for _ in PIPELINE[:-2]:
        provisioner.apply(job, StepResult(True, {"verified": True, "simulation": False}))
    assert job.state == State.ACCEPTANCE_PASSED
    engine = AcceptanceEngine(Probe())
    status = engine.evaluate(job)
    assert status == AcceptanceStatus.PASSED
    engine.promote(job)
    assert job.state == State.HANDOVER_READY
    print("ACCEPTANCE_ENGINE_SMOKE: PASS")


if __name__ == "__main__":
    demo()
