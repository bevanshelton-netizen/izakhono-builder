"""PostgreSQL durability integration tests for the Provisioner queue/store."""
from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone

from postgres_job_queue import PostgresJobQueue
from postgres_job_store import PostgresJobStore


def dsn() -> str:
    value = os.environ.get("PROVISIONER_TEST_DSN")
    if not value:
        raise RuntimeError("PROVISIONER_TEST_DSN is required")
    return value


def main() -> None:
    import psycopg

    with psycopg.connect(dsn()) as conn:
        store = PostgresJobStore(conn)
        queue = PostgresJobQueue(conn, lease_seconds=30)
        store.initialize()
        queue.initialize()

        # Fresh job + durable queue entry.
        job, created = store.create_or_get("tenant-it", "idem-it", "job-it")
        assert created
        queue.enqueue(job)

        # Two independent connections/workers: only one can claim the row.
        with psycopg.connect(dsn()) as conn2:
            queue2 = PostgresJobQueue(conn2, lease_seconds=30)
            first = queue.claim("worker-a")
            second = queue2.claim("worker-b")
            assert first is not None
            assert second is None
            claimed_job, lease_id = first

            # A stale/non-owner worker cannot complete the lease.
            try:
                queue2.complete(claimed_job.job_id, "worker-b:not-the-lease")
            except RuntimeError as exc:
                assert str(exc) == "QUEUE_LEASE_LOST"
            else:
                raise AssertionError("stale worker unexpectedly completed lease")

            # Force expiry and prove recovery makes the job claimable again.
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE provisioner_queue SET lease_until=%s WHERE job_id=%s",
                    (datetime.now(timezone.utc) - timedelta(seconds=1), claimed_job.job_id),
                )
            conn.commit()
            assert queue2.recover_expired() == 1
            recovered = queue2.claim("worker-b")
            assert recovered is not None
            recovered_job, recovered_lease = recovered
            assert recovered_job.job_id == claimed_job.job_id
            queue2.complete(recovered_job.job_id, recovered_lease)

        # Idempotent create_or_get returns the same durable job rather than duplicating it.
        same, created_again = store.create_or_get("tenant-it", "idem-it", "different-id")
        assert not created_again
        assert same.job_id == "job-it"

        print("POSTGRES_DURABILITY: PASS")


if __name__ == "__main__":
    main()
