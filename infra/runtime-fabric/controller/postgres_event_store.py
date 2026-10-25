#!/usr/bin/env python3
"""Durable, append-only PostgreSQL store for Runtime Fabric audit events."""
from __future__ import annotations
import uuid
from typing import Any, Callable, Optional
from observability import RuntimeEvent
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS izakhono_runtime_events (
    event_id TEXT PRIMARY KEY,
    deployment_id TEXT NOT NULL,
    workload TEXT NOT NULL,
    event_type TEXT NOT NULL,
    state TEXT NOT NULL,
    node TEXT,
    detail TEXT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    evidence BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)
"""
class PostgresEventStore:
    """Append-only RuntimeEvent sink; never authorizes promotion."""
    def __init__(self, connection_factory: Callable[[], Any]): self.connection_factory = connection_factory
    def initialize(self) -> None:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur: cur.execute(CREATE_TABLE_SQL)
            conn.commit()
        finally: conn.close()
    @staticmethod
    def _row(row) -> dict[str, Any]:
        return {"event_id": row[0], "deployment_id": row[1], "workload": row[2], "event_type": row[3], "state": row[4], "node": row[5], "detail": row[6], "observed_at": row[7].isoformat() if hasattr(row[7], "isoformat") else str(row[7]), "evidence": bool(row[8]), "created_at": row[9].isoformat() if hasattr(row[9], "isoformat") else str(row[9])}
    def append(self, event: RuntimeEvent, event_id: Optional[str] = None) -> str:
        identifier = event_id or str(uuid.uuid4())
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute("""INSERT INTO izakhono_runtime_events (event_id, deployment_id, workload, event_type, state, node, detail, observed_at, evidence) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)""", (identifier, event.deployment_id, event.workload, event.event_type, event.state, event.node, event.detail, event.observed_at, event.evidence))
            conn.commit()
            return identifier
        finally: conn.close()
    def for_deployment(self, deployment_id: str) -> list[dict[str, Any]]:
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute("""SELECT event_id, deployment_id, workload, event_type, state, node, detail, observed_at, evidence, created_at FROM izakhono_runtime_events WHERE deployment_id = %s ORDER BY observed_at ASC, event_id ASC""", (deployment_id,))
                return [self._row(row) for row in cur.fetchall()]
        finally: conn.close()
    def list_recent(self, limit: int = 100) -> list[dict[str, Any]]:
        if limit < 1: raise ValueError("limit must be >= 1")
        conn = self.connection_factory()
        try:
            with conn.cursor() as cur:
                cur.execute("""SELECT event_id, deployment_id, workload, event_type, state, node, detail, observed_at, evidence, created_at FROM izakhono_runtime_events ORDER BY observed_at DESC, event_id DESC LIMIT %s""", (limit,))
                return [self._row(row) for row in cur.fetchall()]
        finally: conn.close()
