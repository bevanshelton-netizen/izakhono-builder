#!/usr/bin/env python3
"""Production wiring for the Runtime Fabric recovery supervisor."""
from __future__ import annotations

import os

from recovery_reconciler import DeploymentReconciler
from recovery_worker import RecoveryWorker
from recovery_supervisor import RecoverySupervisor, SupervisorConfig
from runtime_store_factory import build_store


def build_supervisor() -> RecoverySupervisor:
    store = build_store()
    # Failover and deployment adapters remain injected by the node runtime.
    # This wiring deliberately refuses to invent an infrastructure adapter.
    failover_selector = os.getenv("IZAKHONO_FAILOVER_SELECTOR")
    if not failover_selector:
        raise RuntimeError("IZAKHONO_FAILOVER_SELECTOR runtime adapter is required")
    raise RuntimeError(
        "Provider-neutral supervisor wiring requires an injected reconciler adapter; "
        "no infrastructure action is performed by this factory"
    )
