#!/usr/bin/env python3
"""PostgreSQL durable store for IZAKHONO Runtime Fabric deployments."""
from __future__ import annotations

import json
from typing import Any, Callable, Optional

from deployment_state import DeploymentRecord, TERMINAL


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


class PostgresDeploymentStore:
    """Durable implementation of the deployment state store contract."""

    def __init__(self, connection_factory: Callable[[], Any]):
        self.connection_factory = connection_factory

    def initialize(self) -> None:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute(CREATE_TABLE_SQL)
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
        """Return all non-terminal deployments for reconciliation."""
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
                      workload = EXCLUDED.workload,
                      state = EXCLUDED.state,
                      node = EXCLUDED.node,
                      checkpoint = EXCLUDED.checkpoint,
                      attempts = EXCLUDED.attempts,
                      metadata = EXCLUDED.metadata,
                      updated_at = NOW()""",
                    (record.deployment_id, record.workload, record.state, record.node,
                     record.checkpoint, record.attempts, json.dumps(record.metadata, sort_keys=True)),
                )
            conn.commit()
            return record
        finally:
            conn.close()
