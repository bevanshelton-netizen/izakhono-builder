#!/usr/bin/env python3
"""IZAKHONO PROVISIONER acceptance engine v1.

Independent, provider-neutral acceptance gates. An adapter may report that an
operation succeeded, but only acceptance checks can certify the resulting
state for handover.
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
    for state in PIPELINE[:-1]
)


class AcceptanceEngine:
    """Certify a job only when every required state has independent evidence."""

    def __init__(self, probe: AcceptanceProbe):
        self.probe = probe

    def evaluate(self, job: ProvisioningJob) -> AcceptanceStatus:
        job.record("ACCEPTANCE_STARTED", state=job.state.value)
        failures: list[str] = []
        missing: list[str] = []

        for check in REQUIRED_CHECKS:
            if check.state.value not in job.evidence:
                missing.append(check.check_id)
                continue
            result = self.probe.check(check, job)
            job.record(
                "ACCEPTANCE_CHECK",
                check_id=check.check_id,
                ok=result.ok,
                error_code=result.error_code,
            )
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

    from state_machine import Provisioner, StepResult

    provisioner = Provisioner()
    job = provisioner.create("tenant-acceptance", "acceptance-001")
    for state in PIPELINE[:-2]:
        provisioner.apply(job, StepResult(True, {"verified": True}))
    assert job.state == State.ACCEPTANCE_PASSED
    engine = AcceptanceEngine(Probe())
    status = engine.evaluate(job)
    assert status == AcceptanceStatus.PASSED
    engine.promote(job)
    assert job.state == State.HANDOVER_READY
    print("ACCEPTANCE_ENGINE_SMOKE: PASS")


if __name__ == "__main__":
    demo()
