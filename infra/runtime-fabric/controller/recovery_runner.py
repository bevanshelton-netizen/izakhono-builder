#!/usr/bin/env python3
"""Production entrypoint for durable Runtime Fabric recovery reconciliation."""
from __future__ import annotations

import importlib
import os
import sys
import time

from postgres_deployment_store import PostgresDeploymentStore
from recovery_reconciler import DeploymentReconciler
from recovery_worker import RecoveryWorker


def _required_env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"missing required environment variable: {name}")
    return value


def _adapter():
    module_name = _required_env("IZAKHONO_RECOVERY_ADAPTER")
    module = importlib.import_module(module_name)
    required = ("node_health", "resume_action", "rollback_action", "failover_selector")
    missing = [name for name in required if not callable(getattr(module, name, None))]
    if missing:
        raise RuntimeError(f"recovery adapter missing callables: {', '.join(missing)}")
    return module


def build_worker() -> RecoveryWorker:
    database_url = _required_env("IZAKHONO_RUNTIME_DATABASE_URL")
    owner_id = os.environ.get("IZAKHONO_RECOVERY_OWNER_ID", "recovery-worker")
    lease_ttl = int(os.environ.get("IZAKHONO_RECOVERY_LEASE_TTL_SECONDS", "300"))
    if lease_ttl < 30:
        raise RuntimeError("IZAKHONO_RECOVERY_LEASE_TTL_SECONDS must be >= 30")

    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError("psycopg is required for PostgreSQL Runtime Fabric recovery") from exc

    store = PostgresDeploymentStore(lambda: psycopg.connect(database_url))
    store.initialize()
    adapter = _adapter()
    reconciler = DeploymentReconciler(
        store=store,
        node_health=adapter.node_health,
        resume_action=adapter.resume_action,
        rollback_action=adapter.rollback_action,
        failover_selector=adapter.failover_selector,
    )

    class LeaseStore:
        def acquire(self, deployment_id, owner_id):
            return store.acquire(deployment_id, owner_id, ttl_seconds=lease_ttl)

        def release(self, deployment_id, owner_id):
            return store.release(deployment_id, owner_id)

    return RecoveryWorker(store, reconciler, lease_store=LeaseStore(), owner_id=owner_id)


def main() -> int:
    worker = build_worker()
    interval = int(os.environ.get("IZAKHONO_RECOVERY_INTERVAL_SECONDS", "60"))
    once = os.environ.get("IZAKHONO_RECOVERY_ONCE", "0") == "1"
    if interval < 10:
        raise RuntimeError("IZAKHONO_RECOVERY_INTERVAL_SECONDS must be >= 10")

    while True:
        results = worker.run_once()
        for result in results:
            print(
                f"RECOVERY deployment={result.deployment_id} status={result.status} "
                f"state={result.state} action={result.action} reason={result.reason}",
                flush=True,
            )
        if once:
            return 0
        time.sleep(interval)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"RECOVERY_RUNNER_BLOCKED: {exc}", file=sys.stderr)
        raise SystemExit(2)
