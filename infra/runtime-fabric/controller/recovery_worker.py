#!/usr/bin/env python3
"""Provider-neutral reconciliation loop with distributed deployment leases."""
from __future__ import annotations

from recovery_reconciler import DeploymentReconciler, ReconcileResult
from deployment_lease import MemoryLeaseStore


class RecoveryWorker:
    """Discover interrupted deployments and reconcile only owned leases."""

    def __init__(self, store, reconciler: DeploymentReconciler,
                 lease_store=None, owner_id: str = "recovery-worker"):
        self.store = store
        self.reconciler = reconciler
        self.lease_store = lease_store or MemoryLeaseStore()
        self.owner_id = owner_id

    def run_once(self) -> list[ReconcileResult]:
        results = []
        for record in self.store.list_active():
            if not self.lease_store.acquire(record.deployment_id, self.owner_id):
                results.append(ReconcileResult(
                    record.deployment_id, "LEASED", record.state, "none",
                    "deployment owned by another recovery worker",
                ))
                continue
            try:
                results.append(self.reconciler.reconcile(record.deployment_id))
            finally:
                self.lease_store.release(record.deployment_id, self.owner_id)
        return results
