#!/usr/bin/env python3
"""Provider-neutral factory for durable Runtime Fabric deployment state."""
from __future__ import annotations

import os
from typing import Any, Callable

from postgres_deployment_store import PostgresDeploymentStore


def postgres_connection_factory() -> Callable[[], Any]:
    """Return a lazy PostgreSQL connection factory without reading credentials into logs."""
    try:
        import psycopg  # type: ignore
    except ImportError as exc:
        raise RuntimeError("psycopg is required for PostgreSQL runtime state") from exc

    dsn = os.getenv("IZAKHONO_RUNTIME_DATABASE_URL")
    if not dsn:
        raise RuntimeError("IZAKHONO_RUNTIME_DATABASE_URL is required")

    def connect() -> Any:
        return psycopg.connect(dsn)

    return connect


def build_store() -> PostgresDeploymentStore:
    """Build and initialize the production durable store; fail closed if unavailable."""
    store = PostgresDeploymentStore(postgres_connection_factory())
    store.initialize()
    return store
