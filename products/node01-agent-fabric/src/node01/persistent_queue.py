from __future__ import annotations

import hashlib
import json
import sqlite3
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class Lease:
    task_id: str
    capability: str
    payload: dict[str, Any]
    idempotency_key: str
    worker_id: str
    lease_until: float
    attempt: int


class SQLiteTaskQueue:
    """Dependency-free durable queue boundary for NODE01.

    SQLite provides persistent local state. Production may replace this adapter
    with an IZAKHONO-owned queue/store without changing worker semantics.
    """

    def __init__(self, path: str | Path = ":memory:", *, max_attempts: int = 3) -> None:
        self.path = str(path)
        self.max_attempts = max(1, max_attempts)
        self._db = sqlite3.connect(self.path, check_same_thread=False)
        self._db.row_factory = sqlite3.Row
        self._db.execute("PRAGMA journal_mode=WAL")
        self._db.execute("PRAGMA busy_timeout=5000")
        self._init_schema()

    def _init_schema(self) -> None:
        self._db.executescript(
            """
            CREATE TABLE IF NOT EXISTS tasks (
                task_id TEXT PRIMARY KEY,
                capability TEXT NOT NULL,
                payload TEXT NOT NULL,
                idempotency_key TEXT NOT NULL UNIQUE,
                status TEXT NOT NULL DEFAULT 'queued',
                attempt INTEGER NOT NULL DEFAULT 0,
                lease_owner TEXT,
                lease_until REAL,
                created_at REAL NOT NULL,
                updated_at REAL NOT NULL
            );
            CREATE TABLE IF NOT EXISTS receipts (
                task_id TEXT PRIMARY KEY,
                worker_id TEXT NOT NULL,
                status TEXT NOT NULL,
                result TEXT NOT NULL,
                evidence_hash TEXT NOT NULL,
                completed_at REAL NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_tasks_ready ON tasks(status, capability, created_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_lease ON tasks(status, lease_until);
            """
        )
        self._db.commit()

    def submit(self, capability: str, payload: dict[str, Any], idempotency_key: str | None = None) -> str:
        key = idempotency_key or hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        task_id = str(uuid.uuid4())
        now = time.time()
        try:
            self._db.execute(
                "INSERT INTO tasks(task_id, capability, payload, idempotency_key, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
                (task_id, capability, json.dumps(payload, sort_keys=True), key, now, now),
            )
            self._db.commit()
        except sqlite3.IntegrityError as exc:
            raise ValueError(f"duplicate idempotency key: {key}") from exc
        return task_id

    def recover_expired(self, now: float | None = None) -> int:
        now = time.time() if now is None else now
        cur = self._db.execute(
            "UPDATE tasks SET status='queued', lease_owner=NULL, lease_until=NULL, updated_at=? WHERE status='leased' AND lease_until <= ?",
            (now, now),
        )
        self._db.commit()
        return cur.rowcount

    def lease(self, worker_id: str, capabilities: set[str], *, lease_seconds: float = 30.0) -> Lease | None:
        if not capabilities:
            return None
        now = time.time()
        self.recover_expired(now)
        placeholders = ",".join("?" for _ in capabilities)
        row = self._db.execute(
            f"SELECT * FROM tasks WHERE status='queued' AND capability IN ({placeholders}) ORDER BY created_at LIMIT 1",
            tuple(sorted(capabilities)),
        ).fetchone()
        if row is None:
            return None
        until = now + max(1.0, lease_seconds)
        cur = self._db.execute(
            "UPDATE tasks SET status='leased', attempt=attempt+1, lease_owner=?, lease_until=?, updated_at=? WHERE task_id=? AND status='queued'",
            (worker_id, until, now, row["task_id"]),
        )
        if cur.rowcount != 1:
            self._db.rollback()
            return None
        self._db.commit()
        return Lease(
            row["task_id"], row["capability"], json.loads(row["payload"]),
            row["idempotency_key"], worker_id, until, row["attempt"] + 1,
        )

    def renew(self, lease: Lease, lease_seconds: float = 30.0) -> bool:
        until = time.time() + max(1.0, lease_seconds)
        cur = self._db.execute(
            "UPDATE tasks SET lease_until=?, updated_at=? WHERE task_id=? AND status='leased' AND lease_owner=?",
            (until, time.time(), lease.task_id, lease.worker_id),
        )
        self._db.commit()
        return cur.rowcount == 1

    def complete(self, lease: Lease, result: dict[str, Any], status: str = "completed") -> str:
        now = time.time()
        canonical = json.dumps({"task_id": lease.task_id, "worker_id": lease.worker_id, "status": status, "result": result}, sort_keys=True)
        evidence_hash = hashlib.sha256(canonical.encode()).hexdigest()
        cur = self._db.execute(
            "UPDATE tasks SET status=?, lease_owner=NULL, lease_until=NULL, updated_at=? WHERE task_id=? AND status='leased' AND lease_owner=?",
            (status, now, lease.task_id, lease.worker_id),
        )
        if cur.rowcount != 1:
            self._db.rollback()
            raise PermissionError("lease ownership lost")
        self._db.execute(
            "INSERT OR REPLACE INTO receipts(task_id, worker_id, status, result, evidence_hash, completed_at) VALUES (?, ?, ?, ?, ?, ?)",
            (lease.task_id, lease.worker_id, status, json.dumps(result, sort_keys=True), evidence_hash, now),
        )
        self._db.commit()
        return evidence_hash

    def fail(self, lease: Lease, error: str) -> str:
        now = time.time()
        if lease.attempt >= self.max_attempts:
            status = "dead_letter"
        else:
            status = "queued"
        cur = self._db.execute(
            "UPDATE tasks SET status=?, lease_owner=NULL, lease_until=NULL, updated_at=? WHERE task_id=? AND status='leased' AND lease_owner=?",
            (status, now, lease.task_id, lease.worker_id),
        )
        if cur.rowcount != 1:
            self._db.rollback()
            raise PermissionError("lease ownership lost")
        self._db.commit()
        return status

    def snapshot(self) -> dict[str, int]:
        rows = self._db.execute("SELECT status, COUNT(*) AS count FROM tasks GROUP BY status").fetchall()
        snapshot = {row["status"]: row["count"] for row in rows}
        snapshot.setdefault("queued", 0)
        snapshot.setdefault("leased", 0)
        snapshot.setdefault("completed", 0)
        snapshot.setdefault("dead_letter", 0)
        return snapshot

    def close(self) -> None:
        self._db.close()
