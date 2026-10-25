#!/usr/bin/env python3
"""PostgreSQL durable store and atomic leases for Runtime Fabric deployments."""
from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from deployment_state import DeploymentRecord, TERMINAL
from deployment_lease import Lease


CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS izakhono_runtime_deployments (
    deployment_id TEXT PRIMARY KEY,
    workload TEXT NOT NULL,
    state TEXT NOT NULL,
    node TEXT,
    checkpoint TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""

CREATE_LEASES_SQL = """
CREATE TABLE IF NOT EXISTS izakhono_runtime_deployment_leases (
    deployment_id TEXT PRIMARY KEY REFERENCES izakhono_runtime_deployments(deployment_id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""


class PostgresDeploymentStore:
    """Durable implementation of deployment state plus atomic recovery leases."""

    def __init__(self, connection_factory: Callable[[], Any]):
        self.connection_factory = connection_factory

    def initialize(self) -> None:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(CREATE_TABLE_SQL)
                cur.execute(CREATE_LEASES_SQL)
            conn.commit()
        finally:
            conn.close()

    @staticmethod
    def _record(row) -> DeploymentRecord:
        metadata = row[6] if isinstance(row[6], dict) else json.loads(row[6] or "{}")
        return DeploymentRecord(row[0], row[1], row[2], row[3], row[4], int(row[5]), dict(metadata))

    def get(self, deployment_id: str) -> Optional[DeploymentRecord]:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT deployment_id, workload, state, node, checkpoint, attempts, metadata "
                    "FROM izakhono_runtime_deployments WHERE deployment_id = %s",
                    (deployment_id,),
                )
                row = cur.fetchone()
            return None if row is None else self._record(row)
        finally:
            conn.close()

    def list_active(self) -> list[DeploymentRecord]:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT deployment_id, workload, state, node, checkpoint, attempts, metadata "
                    "FROM izakhono_runtime_deployments WHERE state <> ALL(%s) ORDER BY updated_at ASC",
                    (list(TERMINAL),),
                )
                return [self._record(row) for row in cur.fetchall()]
        finally:
            conn.close()

    def put(self, record: DeploymentRecord) -> DeploymentRecord:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO izakhono_runtime_deployments
                    (deployment_id, workload, state, node, checkpoint, attempts, metadata)
                    VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb)
                    ON CONFLICT (deployment_id) DO UPDATE SET
                      workload = EXCLUDED.workload, state = EXCLUDED.state, node = EXCLUDED.node,
                      checkpoint = EXCLUDED.checkpoint, attempts = EXCLUDED.attempts,
                      metadata = EXCLUDED.metadata, updated_at = NOW()""",
                    (record.deployment_id, record.workload, record.state, record.node,
                     record.checkpoint, record.attempts, json.dumps(record.metadata, sort_keys=True)),
                )
            conn.commit()
            return record
        finally:
            conn.close()

    def acquire(self, deployment_id: str, owner_id: str, ttl_seconds: int = 60) -> bool:
        """Atomically acquire a lease, reclaiming only expired ownership."""
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO izakhono_runtime_deployment_leases
                    (deployment_id, owner_id, expires_at)
                    VALUES (%s, %s, NOW() + (%s * INTERVAL '1 second'))
                    ON CONFLICT (deployment_id) DO UPDATE SET
                      owner_id = EXCLUDED.owner_id,
                      expires_at = EXCLUDED.expires_at,
                      updated_at = NOW()
                    WHERE izakhono_runtime_deployment_leases.expires_at <= NOW()
                       OR izakhono_runtime_deployment_leases.owner_id = EXCLUDED.owner_id
                    RETURNING owner_id""",
                    (deployment_id, owner_id, ttl_seconds),
                )
                acquired = cur.fetchone() is not None
            conn.commit()
            return acquired
        finally:
            conn.close()

    def release(self, deployment_id: str, owner_id: str) -> bool:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM izakhono_runtime_deployment_leases "
                    "WHERE deployment_id = %s AND owner_id = %s RETURNING deployment_id",
                    (deployment_id, owner_id),
                )
                released = cur.fetchone() is not None
            conn.commit()
            return released
        finally:
            conn.close()

    def get_lease(self, deployment_id: str) -> Optional[Lease]:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT deployment_id, owner_id, expires_at "
                    "FROM izakhono_runtime_deployment_leases WHERE deployment_id = %s",
                    (deployment_id,),
                )
                row = cur.fetchone()
            if row is None:
                return None
            expires = row[2]
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            return Lease(row[0], row[1], expires)
        finally:
            conn.close()
