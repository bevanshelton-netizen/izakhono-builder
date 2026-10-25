#!/usr/bin/env python3
"""Recovery/reconciliation worker for interrupted Runtime Fabric deployments."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Iterable, Mapping

from deployment_state import DeploymentRecord, TERMINAL, transition
from observability import MemoryEventSink, reconciliation_event

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
                 failover_selector: Callable[[DeploymentRecord], str | None] | None = None,
                 event_sink=None):
        self.store = store
        self.node_health = node_health
        self.resume_action = resume_action
        self.rollback_action = rollback_action or (lambda _record: False)
        self.failover_selector = failover_selector or (lambda _record: None)
        self.event_sink = event_sink or MemoryEventSink()

    def _healthy(self, node: str | None) -> bool:
        if not node:
            return False
        return bool(self.node_health(node) if callable(self.node_health) else self.node_health.get(node, False))

    def _event(self, record: DeploymentRecord, detail: str) -> None:
        self.event_sink.emit(reconciliation_event(
            record.deployment_id, record.workload, record.state, record.node, detail,
        ))

    def reconcile(self, deployment_id: str) -> ReconcileResult:
        record = self.store.get(deployment_id)
        if record is None:
            return ReconcileResult(deployment_id, "NOT_FOUND", "", "none", "deployment not found")
        if record.state in TERMINAL:
            self._event(record, "terminal deployment; no reconciliation required")
            return ReconcileResult(record.deployment_id, "TERMINAL", record.state, "none")
        if record.state not in RESUMABLE:
            self._event(record, "unknown deployment state; reconciliation blocked")
            return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "none", "unknown deployment state")

        if record.state == "ROLLBACK_REQUIRED":
            transition(record, "ROLLING_BACK", self.event_sink)
            self.store.put(record)
            if not self.rollback_action(record):
                transition(record, "FAILED", self.event_sink)
                self.store.put(record)
                self._event(record, "rollback action failed")
                return ReconcileResult(record.deployment_id, "FAILED", record.state, "rollback", "rollback action failed")
            transition(record, "ROLLED_BACK", self.event_sink)
            self.store.put(record)
            self._event(record, "rollback completed")
            return ReconcileResult(record.deployment_id, "ROLLED_BACK", record.state, "rollback")

        if record.state == "ROLLING_BACK":
            if not self.rollback_action(record):
                self._event(record, "rollback retry failed")
                return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "rollback", "rollback action failed")
            transition(record, "ROLLED_BACK", self.event_sink)
            self.store.put(record)
            self._event(record, "rollback retry completed")
            return ReconcileResult(record.deployment_id, "ROLLED_BACK", record.state, "rollback")

        if record.node and not self._healthy(record.node):
            replacement = self.failover_selector(record)
            if not replacement or not self._healthy(replacement):
                self._event(record, "no healthy replacement node")
                return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "failover", "no healthy replacement node")
            record.node = replacement
            record.checkpoint = "failover-selected"
            self.store.put(record)
            self._event(record, f"failover selected replacement node {replacement}")

        if self.resume_action(record):
            record.attempts += 1
            self.store.put(record)
            self._event(record, "deployment resume action succeeded")
            return ReconcileResult(record.deployment_id, "RESUMED", record.state, "resume")
        self._event(record, "deployment resume action failed")
        return ReconcileResult(record.deployment_id, "BLOCKED", record.state, "resume", "resume action failed")

    def reconcile_many(self, deployment_ids: Iterable[str]) -> list[ReconcileResult]:
        return [self.reconcile(deployment_id) for deployment_id in deployment_ids]
