#!/usr/bin/env python3
from datetime import datetime, timedelta, timezone

from deployment_state import MemoryDeploymentStore, ensure_deployment, transition
from deployment_lease import MemoryLeaseStore
from recovery_reconciler import DeploymentReconciler
from recovery_worker import RecoveryWorker


class ActiveOnlyStore(MemoryDeploymentStore):
    def list_active(self):
        return [record for record in self.records.values() if record.state not in {"LIVE_VERIFIED", "ROLLED_BACK", "FAILED"}]


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


def test_competing_workers_cannot_reconcile_same_deployment():
    store = ActiveOnlyStore()
    record = ensure_deployment(store, "dep-lock", "kora-mail")
    transition(record, "PLANNED")
    store.put(record)
    leases = MemoryLeaseStore()
    assert leases.acquire("dep-lock", "worker-a") is True
    worker_b = RecoveryWorker(
        store,
        DeploymentReconciler(store, {}, lambda _item: True),
        leases,
        owner_id="worker-b",
    )
    result = worker_b.run_once()
    assert result[0].status == "LEASED"
    assert result[0].reason.startswith("deployment owned")


def test_expired_lease_can_be_recovered():
    leases = MemoryLeaseStore()
    now = datetime(2026, 1, 1, tzinfo=timezone.utc)
    assert leases.acquire("dep-expire", "worker-a", ttl_seconds=10, now=now)
    later = now + timedelta(seconds=11)
    assert leases.acquire("dep-expire", "worker-b", ttl_seconds=10, now=later)
    assert leases.get("dep-expire").owner_id == "worker-b"


if __name__ == "__main__":
    test_worker_discovers_and_reconciles_active_jobs()
    test_competing_workers_cannot_reconcile_same_deployment()
    test_expired_lease_can_be_recovered()
    print("RECOVERY_WORKER: PASS")
