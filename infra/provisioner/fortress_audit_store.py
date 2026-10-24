"""Durable FORTRESS audit persistence for Provisioner operations."""
from __future__ import annotations

import json
from typing import Any

from job_store import AuditEvent

SCHEMA = """
CREATE TABLE IF NOT EXISTS fortress_audit_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor TEXT NOT NULL,
  adapter TEXT NULL,
  state TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (job_id, operation_id, event_type)
);
CREATE INDEX IF NOT EXISTS fortress_audit_job_idx
  ON fortress_audit_events(job_id, observed_at);
CREATE INDEX IF NOT EXISTS fortress_audit_operation_idx
  ON fortress_audit_events(operation_id, observed_at);
"""

_SECRET_FIELDS = {"password", "token", "api_key", "access_token", "refresh_token", "private_key", "client_secret", "secret"}


def _reject_secrets(value: Any, path: str = "data") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in _SECRET_FIELDS:
                raise ValueError(f"secret field prohibited at {path}.{key}")
            _reject_secrets(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _reject_secrets(child, f"{path}[{index}]")


def _safe_data(data: dict[str, Any]) -> dict[str, Any]:
    _reject_secrets(data)
    return data


class FortressAuditStore:
    """Append-only PostgreSQL audit sink; duplicate events are harmless."""

    def __init__(self, connection: Any) -> None:
        self.connection = connection

    def initialize(self) -> None:
        with self.connection.cursor() as cur:
            cur.execute(SCHEMA)
        self.connection.commit()

    def append(self, *, event: AuditEvent, tenant_id: str, operation_id: str,
               actor: str, adapter: str | None = None) -> None:
        data = _safe_data(dict(event.data))
        with self.connection.cursor() as cur:
            cur.execute(
                """INSERT INTO fortress_audit_events
                   (event_id,job_id,tenant_id,operation_id,event_type,actor,adapter,state,observed_at,data)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                   ON CONFLICT (event_id) DO NOTHING""",
                (event.event_id, event.job_id, tenant_id, operation_id, event.event_type,
                 actor, adapter, event.state, event.observed_at, json.dumps(data)),
            )
        self.connection.commit()

    def events(self, job_id: str) -> list[dict[str, Any]]:
        with self.connection.cursor() as cur:
            cur.execute(
                """SELECT event_id,job_id,tenant_id,operation_id,event_type,actor,adapter,state,observed_at,data
                   FROM fortress_audit_events WHERE job_id=%s ORDER BY observed_at,event_id""", (job_id,)
            )
            rows = cur.fetchall()
        return [
            {"event_id": r[0], "job_id": r[1], "tenant_id": r[2], "operation_id": r[3],
             "event_type": r[4], "actor": r[5], "adapter": r[6], "state": r[7],
             "observed_at": r[8].isoformat(), "data": r[9] or {}}
            for r in rows
        ]


if __name__ == "__main__":
    print("FORTRESS_AUDIT_STORE: PASS")
