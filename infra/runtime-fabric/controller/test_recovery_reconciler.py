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


def test_unhealthy_node_blocks_without_fabricating_failover():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-r2", "site")
    transition(record, "PLANNED")
    record.node = "node01"
    store.put(record)
    worker = DeploymentReconciler(store, {"node01": False, "node02": True}, lambda _item: True)
    result = worker.reconcile("dep-r2")
    assert result.status == "BLOCKED"
    assert result.action == "failover"
    assert store.get("dep-r2").attempts == 0


def test_rollback_required_moves_to_rolling_back_only_after_action():
    store = MemoryDeploymentStore()
    record = ensure_deployment(store, "dep-r3", "site")
    transition(record, "PLANNED")
    transition(record, "ACTIVATING")
    transition(record, "ROLLBACK_REQUIRED")
    store.put(record)
    worker = DeploymentReconciler(store, {}, lambda _item: False, lambda _item: True)
    result = worker.reconcile("dep-r3")
    assert result.status == "ROLLED_BACK_PENDING"
    assert store.get("dep-r3").state == "ROLLING_BACK"


if __name__ == "__main__":
    test_resumes_healthy_deployment()
    test_unhealthy_node_blocks_without_fabricating_failover()
    test_rollback_required_moves_to_rolling_back_only_after_action()
    print("RECOVERY_RECONCILER: PASS")
