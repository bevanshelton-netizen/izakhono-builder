"""Acceptance must reject simulation evidence."""
from acceptance_engine import AcceptanceEngine, AcceptanceStatus, AcceptanceCheck, CheckResult, REQUIRED_CHECKS
from state_machine import Provisioner, PIPELINE, StepResult, State


class Probe:
    def check(self, check: AcceptanceCheck, job):
        return CheckResult(check.check_id, True, {"probe": "independent"})


def main():
    p = Provisioner()
    job = p.create("tenant-simulation", "idem-simulation")
    for state in PIPELINE[:-2]:
        p.apply(job, StepResult(True, {"verified": True, "simulation": state == State.SITE_READY}))
    assert job.state == State.ACCEPTANCE_PASSED
    status = AcceptanceEngine(Probe()).evaluate(job)
    assert status == AcceptanceStatus.FAILED
    assert State.SITE_READY.value in job.evidence
    print("ACCEPTANCE_SIMULATION_GUARD: PASS")


if __name__ == "__main__":
    main()
