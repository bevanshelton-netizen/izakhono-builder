#!/usr/bin/env python3
"""Recovery/reconciliation worker for interrupted Runtime Fabric deployments."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable, Mapping

from deployment_state import DeploymentRecord, TERMINAL, transition

RESUMABLE = {
    "CREATED", "PLANNED", "ACTIVATING", "DEPLOYED", "HEALTH_CHECKING",
    "ACCEPTANCE_PENDING", "READY_FOR_PROMOTION", "ROLLBACK_REQUIRED", "ROLLING_BACK",
}


@dataclass(frozen=True)
class ReconcileResult:
    deployment_id: str
    status: str
    state: str
    action: str
    reason: str = ""


class DeploymentReconciler:
    """Reconcile durable records without inventing acceptance evidence."""

    def __init__(self, store, node_health: Mapping[str, bool] | Callable[[str], bool],
                 resume_action: Callable[[DeploymentRecord], bool],
                 rollback_action: Callable[[DeploymentRecord], bool] | None = None,
                 failover_selector: Callable[[DeploymentRecord], str | None] | None = None):
        self.store = store
        self.node_health = node_health
        self.resume_action = resume_action
        self.rollback_action = rollback_action or (lambda _record: False)
        self.failover_selector = failover_selector or (lambda _record: None)

    def _healthy(self, node: str | None) -> bool:
        if not node:
            return False
        return bool(self.node_health(node) if callable(self.node_health) else self.node_health.get(node, False))

    def reconcile(self, deployment_id: str) -> ReconcileResult:
        record = self.store.get(deployment_id)
        if record is None:
            return ReconcileResult(deployment_id, "NOT_FOUND", "", "none", "deployment not found")
        if record.state in TERMINAL:
            return ReconcileResult(record.deployment_id, "TERMINAL", record.state, "none")
        if record.state not in RESUMABLE:
            return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "none", "unknown deployment state")

        if record.state == "ROLLBACK_REQUIRED":
            transition(record, "ROLLING_BACK")
            self.store.put(record)
            if not self.rollback_action(record):
                transition(record, "FAILED")
                self.store.put(record)
                return ReconcileResult(record.deployment_id, "FAILED", record.state, "rollback", "rollback action failed")
            transition(record, "ROLLED_BACK")
            self.store.put(record)
            return ReconcileResult(record.deployment_id, "ROLLED_BACK", record.state, "rollback")

        if record.state == "ROLLING_BACK":
            if not self.rollback_action(record):
                return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "rollback", "rollback action failed")
            transition(record, "ROLLED_BACK")
            self.store.put(record)
            return ReconcileResult(record.deployment_id, "ROLLED_BACK", record.state, "rollback")

        if record.node and not self._healthy(record.node):
            replacement = self.failover_selector(record)
            if not replacement or not self._healthy(replacement):
                return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "failover", "no healthy replacement node")
            record.node = replacement
            record.checkpoint = "failover-selected"
            self.store.put(record)

        if self.resume_action(record):
            record.attempts += 1
            self.store.put(record)
            return ReconcileResult(record.deployment_id, "RESUMED", record.state, "resume")
        return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "resume", "resume action failed")

    def reconcile_many(self, deployment_ids: Iterable[str]) -> list[ReconcileResult]:
        return [self.reconcile(deployment_id) for deployment_id in deployment_ids]
