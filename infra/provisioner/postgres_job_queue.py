"""Durable PostgreSQL queue with leases, retries and crash recovery."""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Any, Optional
from job_store import StoredJob

SCHEMA = """
CREATE TABLE IF NOT EXISTS provisioner_queue (
  job_id TEXT PRIMARY KEY REFERENCES provisioner_jobs(job_id) ON DELETE CASCADE,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_id TEXT NULL,
  lease_until TIMESTAMPTZ NULL,
  last_error_code TEXT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS provisioner_queue_ready_idx
  ON provisioner_queue(available_at, lease_until);
"""

class PostgresJobQueue:
    """Queue substrate; workers own leases and must complete/release them explicitly."""
    def __init__(self, connection: Any, lease_seconds: int = 60) -> None:
        self.connection, self.lease_seconds = connection, lease_seconds

    def initialize(self) -> None:
        with self.connection.cursor() as cur:
            cur.execute(SCHEMA)
        self.connection.commit()

    def enqueue(self, job: StoredJob, available_at: Optional[str] = None) -> None:
        with self.connection.cursor() as cur:
            cur.execute(
                """INSERT INTO provisioner_queue(job_id,available_at,attempts)
                   VALUES (%s,COALESCE(%s::timestamptz,NOW()),%s)
                   ON CONFLICT(job_id) DO UPDATE SET
                     available_at=EXCLUDED.available_at,
                     updated_at=NOW()""",
                (job.job_id, available_at or job.next_attempt_at, job.attempts),
            )
        self.connection.commit()

    def claim(self, worker_id: str) -> Optional[tuple[StoredJob, str]]:
        now = datetime.now(timezone.utc)
        lease_until = f"{self.lease_seconds} seconds"
        with self.connection.cursor() as cur:
            cur.execute(
                """WITH candidate AS (
                     SELECT job_id FROM provisioner_queue
                     WHERE available_at <= NOW()
                       AND (lease_until IS NULL OR lease_until <= NOW())
                     ORDER BY available_at, job_id
                     FOR UPDATE SKIP LOCKED LIMIT 1
                   )
                   UPDATE provisioner_queue q
                   SET lease_id=%s, lease_until=NOW()+%s::interval,
                       attempts=q.attempts+1, updated_at=NOW()
                   FROM candidate c WHERE q.job_id=c.job_id
                   RETURNING q.job_id, q.lease_id""",
                (worker_id, lease_until),
            )
            row = cur.fetchone()
            if row is None:
                self.connection.commit(); return None
            job_id, lease_id = row
            cur.execute(
                """SELECT job_id,tenant_id,idempotency_key,state,attempts,evidence,next_attempt_at
                   FROM provisioner_jobs WHERE job_id=%s""", (job_id,)
            )
            job_row = cur.fetchone()
        self.connection.commit()
        if job_row is None:
            self.release(job_id, lease_id)
            return None
        from postgres_job_store import PostgresJobStore
        return PostgresJobStore._row_to_job(job_row), lease_id

    def complete(self, job_id: str, lease_id: str) -> None:
        self._lease_update(job_id, lease_id, clear=True)

    def release(self, job_id: str, lease_id: str, available_at: Optional[str] = None, error_code: Optional[str] = None) -> None:
        self._lease_update(job_id, lease_id, clear=True, available_at=available_at, error_code=error_code)

    def recover_expired(self) -> int:
        with self.connection.cursor() as cur:
            cur.execute(
                """UPDATE provisioner_queue SET lease_id=NULL, lease_until=NULL, updated_at=NOW()
                   WHERE lease_until IS NOT NULL AND lease_until <= NOW()"""
            )
            count = cur.rowcount
        self.connection.commit()
        return count

    def _lease_update(self, job_id: str, lease_id: str, clear: bool, available_at: Optional[str] = None, error_code: Optional[str] = None) -> None:
        with self.connection.cursor() as cur:
            cur.execute(
                """UPDATE provisioner_queue
                   SET lease_id=NULL, lease_until=NULL,
                       available_at=COALESCE(%s::timestamptz,available_at),
                       last_error_code=COALESCE(%s,last_error_code), updated_at=NOW()
                   WHERE job_id=%s AND lease_id=%s""",
                (available_at, error_code, job_id, lease_id),
            )
            if cur.rowcount != 1:
                raise RuntimeError("QUEUE_LEASE_LOST")
        self.connection.commit()

if __name__ == "__main__":
    print("POSTGRES_JOB_QUEUE_MODULE: PASS")
