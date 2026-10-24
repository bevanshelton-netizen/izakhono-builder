"""Durable handover records for the IZAKHONO Provisioner."""
from __future__ import annotations

import json
from typing import Any, Optional

SCHEMA = """
CREATE TABLE IF NOT EXISTS provisioner_handovers (
  handover_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL UNIQUE REFERENCES provisioner_jobs(job_id),
  tenant_id TEXT NOT NULL,
  status TEXT NOT NULL,
  evidence_states JSONB NOT NULL DEFAULT '[]'::jsonb,
  acceptance_evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provisioner_handover_tenant_idx
  ON provisioner_handovers(tenant_id, generated_at);
"""

class HandoverStore:
    def __init__(self, connection: Any) -> None:
        self.connection = connection

    def initialize(self) -> None:
        with self.connection.cursor() as cur:
            cur.execute(SCHEMA)
        self.connection.commit()

    def create_or_get(self, handover_id: str, job_id: str, tenant_id: str,
                      evidence_states: list[str], acceptance_evidence: dict[str, Any]) -> dict[str, Any]:
        with self.connection.cursor() as cur:
            cur.execute(
                """INSERT INTO provisioner_handovers
                   (handover_id,job_id,tenant_id,status,evidence_states,acceptance_evidence)
                   VALUES (%s,%s,%s,'HANDOVER_READY',%s::jsonb,%s::jsonb)
                   ON CONFLICT (job_id) DO NOTHING""",
                (handover_id, job_id, tenant_id, json.dumps(evidence_states), json.dumps(acceptance_evidence)),
            )
            cur.execute(
                """SELECT handover_id,job_id,tenant_id,status,evidence_states,acceptance_evidence,generated_at
                   FROM provisioner_handovers WHERE job_id=%s""", (job_id,))
            row = cur.fetchone()
        self.connection.commit()
        if row is None:
            raise RuntimeError("handover record could not be created or recovered")
        return {
            "handover_id": row[0], "job_id": row[1], "tenant_id": row[2], "status": row[3],
            "evidence_states": row[4] or [], "acceptance_evidence": row[5] or {},
            "generated_at": row[6].isoformat() if hasattr(row[6], "isoformat") else row[6],
        }

    def get(self, job_id: str) -> Optional[dict[str, Any]]:
        with self.connection.cursor() as cur:
            cur.execute(
                """SELECT handover_id,job_id,tenant_id,status,evidence_states,acceptance_evidence,generated_at
                   FROM provisioner_handovers WHERE job_id=%s""", (job_id,))
            row = cur.fetchone()
        if row is None:
            return None
        return {
            "handover_id": row[0], "job_id": row[1], "tenant_id": row[2], "status": row[3],
            "evidence_states": row[4] or [], "acceptance_evidence": row[5] or {},
            "generated_at": row[6].isoformat() if hasattr(row[6], "isoformat") else row[6],
        }

if __name__ == "__main__":
    print("HANDOVER_STORE: PASS")
