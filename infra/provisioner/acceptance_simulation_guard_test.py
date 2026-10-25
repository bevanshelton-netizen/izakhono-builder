"""Acceptance must reject simulation evidence."""
from acceptance_engine import AcceptanceEngine
from state_machine import Provisioner, PIPELINE, StepResult, State


class Probe:
    def check(self, job, state):
        evidence = job.evidence.get(state, {})
        return evidence.get("verified") is True and evidence.get("simulation") is not True


def main():
    p = Provisioner()
    job = p.create("tenant-simulation", "idem-simulation")
    for state in PIPELINE[:-2]:
        p.apply(job, StepResult(True, {"verified": True, "simulation": state == State.SITE_READY}))
    status = AcceptanceEngine(Probe()).evaluate(job)
    assert status.status == "FAILED"
    assert State.SITE_READY.value in status.failures
    print("ACCEPTANCE_SIMULATION_GUARD: PASS")


if __name__ == "__main__":
    main()
