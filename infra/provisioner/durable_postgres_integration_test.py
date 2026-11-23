"""PostgreSQL durability integration tests for the Provisioner queue/store."""
from __future__ import annotations
import os
from datetime import datetime, timedelta, timezone

from postgres_job_queue import PostgresJobQueue
from postgres_job_store import PostgresJobStore
from execution_receipt import build_terminal_receipt
from job_store import utc_now


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
            assert queue.claim("worker-c") is None  # terminal lease completion removed the runnable row

        # Durable submission binds the idempotency key to the canonical request digest.
        submitted, submission_created = store.create_or_get_submission(
            "tenant-submission", "idem-submission", "job-submission", "sha256:request-a"
        )
        assert submission_created
        replay, replay_created = store.create_or_get_submission(
            "tenant-submission", "idem-submission", "different-job", "sha256:request-a"
        )
        assert not replay_created and replay.job_id == submitted.job_id
        try:
            store.create_or_get_submission(
                "tenant-submission", "idem-submission", "different-job", "sha256:request-b"
            )
        except ValueError as exc:
            assert "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_REQUEST" in str(exc)
        else:
            raise AssertionError("PostgreSQL accepted a conflicting idempotency payload")

        # Terminal state, receipt event and FORTRESS mirror are persisted together.
        terminal = store.get(submitted.job_id)
        terminal.state = "BLOCKED"
        terminal.evidence["PAYMENT_VERIFIED"] = {
            "evidence_id": "pay-terminal", "observed_at": utc_now(),
            "verified": True, "checks": ["payment.verified"]
        }
        receipt, receipt_event = build_terminal_receipt(terminal, {"error_code": "TEST_BLOCKED"})
        terminal.evidence["TERMINAL_RECEIPT"] = receipt
        store.record_terminal_receipt(terminal, receipt_event)
        persisted = store.get(terminal.job_id)
        assert persisted.state == "BLOCKED"
        first_completed_at = persisted.evidence["TERMINAL_RECEIPT"]["completed_at"]
        assert persisted.evidence["TERMINAL_RECEIPT"]["status"] == "FAILED"
        assert any(event.event_type == "TERMINAL_RECEIPT" for event in store.audit_events(terminal.job_id))
        assert any(event["event_type"] == "TERMINAL_RECEIPT" for event in store.fortress_audit.events(terminal.job_id))

        # Replaying the same terminal event must not replace its original receipt.
        replay_receipt, replay_event = build_terminal_receipt(terminal, {"error_code": "TEST_BLOCKED"})
        terminal.evidence["TERMINAL_RECEIPT"] = replay_receipt
        store.record_terminal_receipt(terminal, replay_event)
        assert store.get(terminal.job_id).evidence["TERMINAL_RECEIPT"]["completed_at"] == first_completed_at
        assert len([event for event in store.audit_events(terminal.job_id) if event.event_type == "TERMINAL_RECEIPT"]) == 1

        # Idempotent create_or_get returns the same durable job rather than duplicating it.
        same, created_again = store.create_or_get("tenant-it", "idem-it", "different-id")
        assert not created_again
        assert same.job_id == "job-it"

        print("POSTGRES_DURABILITY: PASS")


if __name__ == "__main__":
    main()
