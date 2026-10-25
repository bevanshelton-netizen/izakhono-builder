#!/usr/bin/env python3
"""Production wiring for the Runtime Fabric recovery supervisor."""
from __future__ import annotations

from recovery_reconciler import DeploymentReconciler
from recovery_worker import RecoveryWorker
from recovery_supervisor import RecoverySupervisor, SupervisorConfig
from runtime_store_factory import build_store


def build_supervisor(reconciler: DeploymentReconciler,
                     owner_id: str = "recovery-supervisor",
                     config: SupervisorConfig | None = None) -> RecoverySupervisor:
    """Wire durable deployment state + PostgreSQL leases into the supervisor.

    Infrastructure adapters remain injected by the node runtime; this function
    performs no deployment action itself.
    """
    store = build_store()
    worker = RecoveryWorker(
        store=store,
        reconciler=reconciler,
        lease_store=store,
        owner_id=owner_id,
    )
    return RecoverySupervisor(worker=worker, config=config)
