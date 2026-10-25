#!/usr/bin/env python3
"""Provider-neutral reconciliation loop for durable Runtime Fabric state."""
from __future__ import annotations

from recovery_reconciler import DeploymentReconciler, ReconcileResult


class RecoveryWorker:
    """Discover interrupted deployments and hand them to the reconciler."""

    def __init__(self, store, reconciler: DeploymentReconciler):
        self.store = store
        self.reconciler = reconciler

    def run_once(self) -> list[ReconcileResult]:
        active = self.store.list_active()
        return self.reconciler.reconcile_many(record.deployment_id for record in active)
