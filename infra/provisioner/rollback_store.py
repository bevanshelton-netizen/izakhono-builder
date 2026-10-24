"""Durable rollback/reconciliation records for Provisioner recovery."""
from __future__ import annotations

import json
from typing import Any

SCHEMA = """
CREATE TABLE IF NOT EXISTS provisioner_recovery_actions (
  recovery_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  state TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ NULL,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (job_id, operation_id, action)
);
CREATE INDEX IF NOT EXISTS provisioner_recovery_job_idx
  ON provisioner_recovery_actions(job_id, created_at);
"""

_SECRET_FIELDS = {"password", "token", "api_key", "access_token", "refresh_token", "private_key", "client_secret", "secret"}


def _reject_secrets(value: Any) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in _SECRET_FIELDS:
                raise ValueError(f"secret field prohibited: {key}")
            _reject_secrets(child)
    elif isinstance(value, list):
        for child in value:
            _reject_secrets(child)


class RollbackStore:
    def __init__(self, connection: Any) -> None:
        self.connection = connection

    def initialize(self) -> None:
        with self.connection.cursor() as cur:
            cur.execute(SCHEMA)
        self.connection.commit()

    def record(self, *, recovery_id: str, job_id: str, operation_id: str,
               state: str, action: str, status: str, reason: str,
               evidence: dict[str, Any] | None = None) -> None:
        payload = evidence or {}
        _reject_secrets(payload)
        with self.connection.cursor() as cur:
            cur.execute(
                """INSERT INTO provisioner_recovery_actions
                   (recovery_id,job_id,operation_id,state,action,status,reason,evidence)
                   VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                   ON CONFLICT (recovery_id) DO NOTHING""",
                (recovery_id, job_id, operation_id, state, action, status, reason, json.dumps(payload)),
            )
        self.connection.commit()

    def list_for_job(self, job_id: str) -> list[dict[str, Any]]:
        with self.connection.cursor() as cur:
            cur.execute(
                """SELECT recovery_id,job_id,operation_id,state,action,status,reason,created_at,completed_at,evidence
                   FROM provisioner_recovery_actions WHERE job_id=%s ORDER BY created_at,recovery_id""", (job_id,)
            )
            rows = cur.fetchall()
        return [
            {"recovery_id": r[0], "job_id": r[1], "operation_id": r[2], "state": r[3],
             "action": r[4], "status": r[5], "reason": r[6], "created_at": r[7].isoformat(),
             "completed_at": r[8].isoformat() if r[8] else None, "evidence": r[9] or {}}
            for r in rows
        ]


if __name__ == "__main__":
    print("ROLLBACK_STORE: PASS")
