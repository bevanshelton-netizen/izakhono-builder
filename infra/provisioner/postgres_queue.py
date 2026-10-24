"""Durable PostgreSQL queue for Provisioner workers.

The queue uses transactional row leasing so a crashed worker does not lose a job.
It is deliberately separate from the in-memory reference queue and requires an
explicit psycopg-compatible connection factory supplied by the host runtime.
"""
from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Callable, Optional

@dataclass(frozen=True)
class QueueLease:
    job_id: str
    lease_id: str
    attempt: int
    leased_until: str

class PostgresQueue:
    """PostgreSQL-backed queue contract using FOR UPDATE SKIP LOCKED."""
    LEASE_SECONDS = 60
    MAX_ATTEMPTS = 5

    def __init__(self, connection_factory: Callable[[], object]):
        self.connection_factory = connection_factory

    def ensure_schema(self) -> None:
        with self.connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                CREATE TABLE IF NOT EXISTS provisioner_queue (
                    job_id TEXT PRIMARY KEY,
                    available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    attempts INTEGER NOT NULL DEFAULT 0,
                    lease_id TEXT,
                    leased_until TIMESTAMPTZ,
                    last_error_code TEXT,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """)
                cur.execute("CREATE INDEX IF NOT EXISTS provisioner_queue_ready_idx ON provisioner_queue (available_at, updated_at)")
            conn.commit()

    def enqueue(self, job_id: str, available_at: Optional[datetime] = None) -> None:
        available_at = available_at or datetime.now(timezone.utc)
        with self.connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                INSERT INTO provisioner_queue(job_id, available_at, updated_at)
                VALUES (%s, %s, NOW())
                ON CONFLICT (job_id) DO UPDATE SET available_at=EXCLUDED.available_at,
                    leased_until=NULL, lease_id=NULL, updated_at=NOW()
                """, (job_id, available_at))
            conn.commit()

    def claim(self) -> Optional[QueueLease]:
        now = datetime.now(timezone.utc)
        lease_until = now + timedelta(seconds=self.LEASE_SECONDS)
        with self.connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                SELECT job_id, attempts FROM provisioner_queue
                WHERE available_at <= %s
                  AND (leased_until IS NULL OR leased_until <= %s)
                  AND attempts < %s
                ORDER BY available_at, updated_at
                FOR UPDATE SKIP LOCKED LIMIT 1
                """, (now, now, self.MAX_ATTEMPTS))
                row = cur.fetchone()
                if row is None:
                    conn.rollback()
                    return None
                job_id, attempts = row
                lease_id = f"lease_{job_id}_{int(now.timestamp() * 1000000)}"
                next_attempt = attempts + 1
                cur.execute("""
                UPDATE provisioner_queue
                SET attempts=%s, lease_id=%s, leased_until=%s, updated_at=NOW()
                WHERE job_id=%s
                """, (next_attempt, lease_id, lease_until, job_id))
            conn.commit()
        return QueueLease(job_id, lease_id, next_attempt, lease_until.isoformat())

    def complete(self, lease: QueueLease) -> None:
        with self.connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM provisioner_queue WHERE job_id=%s AND lease_id=%s", (lease.job_id, lease.lease_id))
            conn.commit()

    def retry(self, lease: QueueLease, error_code: str, delay_seconds: int) -> None:
        available = datetime.now(timezone.utc) + timedelta(seconds=delay_seconds)
        with self.connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                UPDATE provisioner_queue SET available_at=%s, lease_id=NULL,
                    leased_until=NULL, last_error_code=%s, updated_at=NOW()
                WHERE job_id=%s AND lease_id=%s
                """, (available, error_code, lease.job_id, lease.lease_id))
            conn.commit()

    def block(self, lease: QueueLease, error_code: str) -> None:
        with self.connection_factory() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                UPDATE provisioner_queue SET lease_id=NULL, leased_until=NULL,
                    last_error_code=%s, updated_at=NOW()
                WHERE job_id=%s AND lease_id=%s
                """, (error_code, lease.job_id, lease.lease_id))
                cur.execute("DELETE FROM provisioner_queue WHERE job_id=%s", (lease.job_id,))
            conn.commit()

if __name__ == "__main__":
    print("POSTGRES_QUEUE_CONTRACT: PASS")
