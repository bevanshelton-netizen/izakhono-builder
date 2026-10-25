#!/usr/bin/env python3
from deployment_state import (
    MemoryDeploymentStore,
    checkpoint,
    ensure_deployment,
    resume,
    transition,
)


def test_idempotent_resume_and_checkpoint():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-001", "kora-mail")
    assert ensure_deployment(store, "dep-001", "kora-mail") is record
    transition(record, "PLANNED")
    transition(record, "ACTIVATING")
    checkpoint(record, "pre-deploy")
    resumed = resume(store, "dep-001")
    assert resumed.state == "ACTIVATING"
    assert resumed.checkpoint == "pre-deploy"


def test_invalid_transition_is_rejected():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-002", "site")
    try:
        transition(record, "LIVE_VERIFIED")
    except ValueError as exc:
        assert "invalid deployment transition" in str(exc)
    else:
        raise AssertionError("invalid transition was accepted")


def test_deployment_id_cannot_change_workload():
    store = MemoryDeploymentStore()
    ensure_deployment(store, "dep-003", "site-a")
    try:
        ensure_deployment(store, "dep-003", "site-b")
    except ValueError as exc:
        assert "another workload" in str(exc)
    else:
        raise AssertionError("deployment identity was reused across workloads")


if __name__ == "__main__":
    test_idempotent_resume_and_checkpoint()
    test_invalid_transition_is_rejected()
    test_deployment_id_cannot_change_workload()
    print("DEPLOYMENT_STATE_MACHINE: PASS")
