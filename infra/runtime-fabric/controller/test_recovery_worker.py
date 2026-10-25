#!/usr/bin/env python3
from deployment_state import MemoryDeploymentStore, ensure_deployment, transition
from recovery_reconciler import DeploymentReconciler
from recovery_worker import RecoveryWorker


class ActiveOnlyStore(MemoryDeploymentStore):
    def list_active(self):
        return [record for record in self._records.values() if record.state not in {"LIVE_VERIFIED", "ROLLED_BACK", "FAILED"}]


def test_worker_discovers_and_reconciles_active_jobs():
    store = ActiveOnlyStore()
    first = ensure_deployment(store, "dep-w1", "kora-mail")
    transition(first, "PLANNED")
    first.node = "node01"
    store.put(first)
    terminal = ensure_deployment(store, "dep-w2", "site")
    transition(terminal, "PLANNED")
    transition(terminal, "ACTIVATING")
    transition(terminal, "ROLLBACK_REQUIRED")
    transition(terminal, "ROLLING_BACK")
    transition(terminal, "ROLLED_BACK")
    store.put(terminal)

    worker = RecoveryWorker(
        store,
        DeploymentReconciler(store, {"node01": True}, lambda _item: True),
    )
    results = worker.run_once()
    assert [item.deployment_id for item in results] == ["dep-w1"]
    assert results[0].status == "RESUMED"


if __name__ == "__main__":
    test_worker_discovers_and_reconciles_active_jobs()
    print("RECOVERY_WORKER: PASS")
