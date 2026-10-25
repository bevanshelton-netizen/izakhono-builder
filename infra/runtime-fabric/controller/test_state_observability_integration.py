#!/usr/bin/env python3
from deployment_state import MemoryDeploymentStore, ensure_deployment, transition, checkpoint
from observability import MemoryEventSink
from recovery_reconciler import DeploymentReconciler
from recovery_worker import RecoveryWorker
from deployment_lease import MemoryLeaseStore


def main() -> None:
    sink = MemoryEventSink()
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "obs-1", "kora-mail")
    transition(record, "PLANNED", sink)
    checkpoint(record, "planned", sink)
    transition(record, "ACTIVATING", sink)
    assert [e.event_type for e in sink.events] == ["state_transition", "checkpoint", "state_transition"]

    reconciler = DeploymentReconciler(
        store,
        {"node01": True},
        lambda _record: True,
        event_sink=sink,
    )
    worker = RecoveryWorker(store, reconciler, MemoryLeaseStore(), "worker-a", sink)
    results = worker.run_once()
    assert results and results[0].status == "RESUMED"
    assert any(e.event_type == "reconciliation" for e in sink.events)
    assert not any(e.evidence and e.state == "LIVE_VERIFIED" for e in sink.events)
    print("STATE_OBSERVABILITY_INTEGRATION: PASS")


if __name__ == "__main__":
    main()
