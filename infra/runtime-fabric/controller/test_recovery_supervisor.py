#!/usr/bin/env python3
"""Deterministic tests for the Runtime Fabric recovery supervisor."""
from recovery_supervisor import RecoverySupervisor, SupervisorConfig


class FakeWorker:
    def __init__(self):
        self.calls = 0

    def run_once(self):
        self.calls += 1
        return []


def test_bounded_cycles():
    worker = FakeWorker()
    sleeps = []
    supervisor = RecoverySupervisor(
        worker,
        SupervisorConfig(interval_seconds=7, max_cycles=3),
        sleeper=sleeps.append,
    )
    assert supervisor.run() == 3
    assert worker.calls == 3
    assert sleeps == [7, 7]


def test_environment_validation():
    try:
        SupervisorConfig(interval_seconds=0)
    except ValueError:
        pass
    else:
        raise AssertionError("zero interval must be rejected")


if __name__ == "__main__":
    test_bounded_cycles()
    test_environment_validation()
    print("RECOVERY_SUPERVISOR: PASS")
