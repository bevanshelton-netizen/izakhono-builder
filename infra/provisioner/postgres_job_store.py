"""PostgreSQL-backed durable Provisioner store with FORTRESS audit mirroring."""
from __future__ import annotations

import json
from typing import Any, Optional, Tuple

from job_store import AuditEvent, JobStore, StoredJob
from fortress_audit_store import FortressAuditStore

SCHEMA = """
CREATE TABLE IF NOT EXISTS provisioner_jobs (
  job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  evidence JSONB NOT NULL DEFAULT '{}'::jsonb,
  next_attempt_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS provisioner_audit_events (
  event_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES provisioner_jobs(job_id),
  event_type TEXT NOT NULL,
  state TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS provisioner_audit_job_idx
  ON provisioner_audit_events(job_id, observed_at);
"""

class PostgresJobStore(JobStore):
    """Durable JobStore using PostgreSQL; audit events are mirrored to FORTRESS."""
    def __init__(self, connection: Any, fortress_audit: FortressAuditStore | None = None) -> None:
        self.connection = connection
        self.fortress_audit = fortress_audit or FortressAuditStore(connection)

    def initialize(self) -> None:
        with self.connection.cursor() as cur:
            cur.execute(SCHEMA)
        self.connection.commit()
        self.fortress_audit.initialize()

    @staticmethod
    def _row_to_job(row: Any) -> StoredJob:
        return StoredJob(job_id=row[0], tenant_id=row[1], idempotency_key=row[2], state=row[3],
                         attempts=row[4], evidence=row[5] or {},
                         next_attempt_at=row[6].isoformat() if row[6] else None)

    def create_or_get(self, tenant_id: str, idempotency_key: str, job_id: str) -> Tuple[StoredJob, bool]:
        with self.connection.cursor() as cur:
            cur.execute("""INSERT INTO provisioner_jobs(job_id,tenant_id,idempotency_key,state)
                           VALUES (%s,%s,%s,'PAYMENT_VERIFIED')
                           ON CONFLICT (tenant_id,idempotency_key) DO NOTHING""",
                        (job_id, tenant_id, idempotency_key))
            created = cur.rowcount == 1
            cur.execute("""SELECT job_id,tenant_id,idempotency_key,state,attempts,evidence,next_attempt_at
                           FROM provisioner_jobs WHERE tenant_id=%s AND idempotency_key=%s""",
                        (tenant_id, idempotency_key))
            row = cur.fetchone()
        self.connection.commit()
        if row is None:
            raise RuntimeError("provisioner job could not be created or recovered")
        return self._row_to_job(row), created

    def get(self, job_id: str) -> Optional[StoredJob]:
        with self.connection.cursor() as cur:
            cur.execute("""SELECT job_id,tenant_id,idempotency_key,state,attempts,evidence,next_attempt_at
                           FROM provisioner_jobs WHERE job_id=%s""", (job_id,))
            row = cur.fetchone()
        return self._row_to_job(row) if row else None

    def save(self, job: StoredJob) -> None:
        with self.connection.cursor() as cur:
            cur.execute("""UPDATE provisioner_jobs SET state=%s, attempts=%s, evidence=%s::jsonb,
                           next_attempt_at=%s, updated_at=NOW() WHERE job_id=%s""",
                        (job.state, job.attempts, json.dumps(job.evidence), job.next_attempt_at, job.job_id))
            if cur.rowcount != 1:
                raise KeyError(job.job_id)
        self.connection.commit()

    def append_audit(self, event: AuditEvent) -> None:
        with self.connection.cursor() as cur:
            cur.execute("""INSERT INTO provisioner_audit_events
                           (event_id,job_id,event_type,state,observed_at,data)
                           VALUES (%s,%s,%s,%s,%s,%s::jsonb)
                           ON CONFLICT (event_id) DO NOTHING""",
                        (event.event_id, event.job_id, event.event_type, event.state,
                         event.observed_at, json.dumps(event.data)))
        self.connection.commit()
        job = self.get(event.job_id)
        if job is not None:
            self.fortress_audit.append(event=event, tenant_id=job.tenant_id,
                                       operation_id=event.data.get("operation_id", event.event_id),
                                       actor=event.data.get("actor", "provisioner-worker"),
                                       adapter=event.data.get("adapter"))

    def audit_events(self, job_id: str) -> list[AuditEvent]:
        with self.connection.cursor() as cur:
            cur.execute("""SELECT event_id,job_id,event_type,state,observed_at,data
                           FROM provisioner_audit_events WHERE job_id=%s
                           ORDER BY observed_at,event_id""", (job_id,))
            rows = cur.fetchall()
        return [AuditEvent(r[0], r[1], r[2], r[3], r[4].isoformat(), r[5] or {}) for r in rows]


def connect_from_dsn(dsn: str) -> PostgresJobStore:
    try:
        import psycopg
    except ImportError as exc:
        raise RuntimeError("psycopg is required for the PostgreSQL runtime") from exc
    return PostgresJobStore(psycopg.connect(dsn))

if __name__ == "__main__":
    print("POSTGRES_JOB_STORE_MODULE: PASS")
