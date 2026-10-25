#!/usr/bin/env python3
from deployment_state import MemoryDeploymentStore, ensure_deployment, transition
from recovery_reconciler import DeploymentReconciler


def test_resumes_healthy_deployment():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-r1", "kora-mail")
    transition(record, "PLANNED")
    record.node = "node01"
    store.put(record)
    seen = []
    worker = DeploymentReconciler(store, {"node01": True}, lambda item: seen.append(item.node) or True)
    result = worker.reconcile("dep-r1")
    assert result.status == "RESUMED"
    assert seen == ["node01"]
    assert store.get("dep-r1").attempts == 1


def test_unhealthy_node_uses_healthy_failover():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-r2", "site")
    transition(record, "PLANNED")
    record.node = "node01"
    store.put(record)
    worker = DeploymentReconciler(
        store,
        {"node01": False, "node02": True},
        lambda item: item.node == "node02",
        failover_selector=lambda _item: "node02",
    )
    result = worker.reconcile("dep-r2")
    assert result.status == "RESUMED"
    assert store.get("dep-r2").node == "node02"
    assert store.get("dep-r2").checkpoint == "failover-selected"


def test_unhealthy_node_blocks_without_healthy_replacement():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-r3", "site")
    transition(record, "PLANNED")
    record.node = "node01"
    store.put(record)
    worker = DeploymentReconciler(store, {"node01": False, "node02": False}, lambda _item: True,
                                   failover_selector=lambda _item: "node02")
    result = worker.reconcile("dep-r3")
    assert result.status == "BLOCKED"
    assert result.action == "failover"
    assert store.get("dep-r3").attempts == 0


def test_rollback_required_completes_only_after_rollback_action():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-r4", "site")
    transition(record, "PLANNED")
    transition(record, "ACTIVATING")
    transition(record, "ROLLBACK_REQUIRED")
    store.put(record)
    worker = DeploymentReconciler(store, {}, lambda _item: False, lambda _item: True)
    result = worker.reconcile("dep-r4")
    assert result.status == "ROLLED_BACK"
    assert store.get("dep-r4").state == "ROLLED_BACK"


if __name__ == "__main__":
    test_resumes_healthy_deployment()
    test_unhealthy_node_uses_healthy_failover()
    test_unhealthy_node_blocks_without_healthy_replacement()
    test_rollback_required_completes_only_after_rollback_action()
    print("RECOVERY_RECONCILER: PASS")
