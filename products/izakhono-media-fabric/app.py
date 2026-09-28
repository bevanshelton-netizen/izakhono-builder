#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

HOST = os.getenv("IZAKHONO_MEDIA_FABRIC_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_MEDIA_FABRIC_PORT", "9751"))
INTERNAL_KEY = os.getenv("IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY", "")
PAYLOAD_KEY_B64 = os.getenv("IZAKHONO_MEDIA_FABRIC_PAYLOAD_KEY", "")
DB_PATH = Path(os.getenv("IZAKHONO_MEDIA_FABRIC_DB", "/var/lib/izakhono/media-fabric/fabric.db")).resolve()
ARTIFACT_ROOT = Path(os.getenv("IZAKHONO_MEDIA_FABRIC_ARTIFACT_ROOT", "/var/lib/izakhono/media-fabric/artifacts")).resolve()
ASSET_BASE_URL = os.getenv("IZAKHONO_MEDIA_FABRIC_ASSET_BASE_URL", f"http://127.0.0.1:{PORT}").rstrip("/")
REPLICATED_STORAGE = os.getenv("IZAKHONO_MEDIA_FABRIC_REPLICATED_STORAGE", "false").lower() == "true"
MAX_BODY = int(os.getenv("IZAKHONO_MEDIA_FABRIC_MAX_BODY", "20000000"))
MAX_ARTIFACT_BYTES = int(os.getenv("IZAKHONO_MEDIA_FABRIC_MAX_ARTIFACT_BYTES", str(2 * 1024 * 1024 * 1024)))
DEFAULT_LEASE_SECONDS = max(30, int(os.getenv("IZAKHONO_MEDIA_FABRIC_LEASE_SECONDS", "180")))
WORKER_STALE_SECONDS = max(30, int(os.getenv("IZAKHONO_MEDIA_FABRIC_WORKER_STALE_SECONDS", "120")))
RETRY_BASE_SECONDS = max(1, int(os.getenv("IZAKHONO_MEDIA_FABRIC_RETRY_BASE_SECONDS", "15")))
SAFE_JOB = re.compile(r"^mf_[a-f0-9]{24}$")
SAFE_WORKER = re.compile(r"^[A-Za-z0-9._:-]{3,96}$")
SAFE_ARTIFACT = re.compile(r"^[A-Za-z0-9._-]{1,120}$")
SUPPORTED_CAPABILITIES = {"speech", "video", "image", "transcription"}

DB_LOCK = threading.RLock()
CIPHER_KEY: bytes | None = None


def now_ts() -> int:
    return int(time.time())


def safe_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(str(a), str(b))


def payload_key() -> bytes:
    global CIPHER_KEY
    if CIPHER_KEY is not None:
        return CIPHER_KEY
    try:
        raw = base64.urlsafe_b64decode(PAYLOAD_KEY_B64.encode("ascii"))
    except Exception as exc:
        raise RuntimeError("invalid_payload_key") from exc
    if len(raw) != 32:
        raise RuntimeError("payload_key_must_be_32_bytes")
    CIPHER_KEY = raw
    return raw


def seal_json(value: Any, aad: str) -> bytes:
    raw = json.dumps(value, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    nonce = os.urandom(12)
    encrypted = AESGCM(payload_key()).encrypt(nonce, raw, aad.encode("utf-8"))
    return nonce + encrypted


def unseal_json(blob: bytes | None, aad: str) -> Any:
    if not blob:
        return None
    nonce, encrypted = blob[:12], blob[12:]
    raw = AESGCM(payload_key()).decrypt(nonce, encrypted, aad.encode("utf-8"))
    return json.loads(raw.decode("utf-8"))


def connect() -> sqlite3.Connection:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(str(DB_PATH), timeout=30, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.execute("PRAGMA synchronous=FULL")
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("PRAGMA busy_timeout=30000")
    return con


def init_db() -> None:
    ARTIFACT_ROOT.mkdir(parents=True, exist_ok=True)
    with DB_LOCK, connect() as con:
        con.executescript(
            """
            CREATE TABLE IF NOT EXISTS jobs (
              id TEXT PRIMARY KEY,
              token_hash TEXT NOT NULL,
              capability TEXT NOT NULL,
              status TEXT NOT NULL,
              priority INTEGER NOT NULL DEFAULT 50,
              created_at INTEGER NOT NULL,
              updated_at INTEGER NOT NULL,
              run_after INTEGER NOT NULL,
              attempts INTEGER NOT NULL DEFAULT 0,
              max_attempts INTEGER NOT NULL DEFAULT 3,
              lease_owner TEXT,
              lease_until INTEGER,
              min_gpu_mb INTEGER NOT NULL DEFAULT 0,
              payload_cipher BLOB NOT NULL,
              result_cipher BLOB,
              last_error TEXT,
              request_key TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_claim
              ON jobs(status, run_after, priority DESC, created_at);
            CREATE INDEX IF NOT EXISTS idx_jobs_request_key
              ON jobs(request_key, created_at DESC);

            CREATE TABLE IF NOT EXISTS workers (
              id TEXT PRIMARY KEY,
              node_id TEXT NOT NULL,
              capabilities_json TEXT NOT NULL,
              gpu_json TEXT NOT NULL,
              labels_json TEXT NOT NULL,
              max_jobs INTEGER NOT NULL DEFAULT 1,
              active_jobs INTEGER NOT NULL DEFAULT 0,
              last_seen INTEGER NOT NULL,
              registered_at INTEGER NOT NULL,
              version TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS artifacts (
              id TEXT PRIMARY KEY,
              job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
              name TEXT NOT NULL,
              mime TEXT NOT NULL,
              relpath TEXT NOT NULL,
              sha256 TEXT NOT NULL,
              bytes INTEGER NOT NULL,
              created_at INTEGER NOT NULL,
              UNIQUE(job_id, name)
            );

            CREATE TABLE IF NOT EXISTS events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              job_id TEXT,
              event TEXT NOT NULL,
              at INTEGER NOT NULL,
              detail TEXT
            );
            """
        )


def add_event(con: sqlite3.Connection, job_id: str | None, event: str, detail: str = "") -> None:
    con.execute(
        "INSERT INTO events(job_id,event,at,detail) VALUES(?,?,?,?)",
        (job_id, event[:80], now_ts(), detail[:300]),
    )


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def submit_job(payload: dict[str, Any]) -> dict[str, Any]:
    if payload.get("schema") != "izakhono.media.job.submit.v1":
        raise ValueError("invalid_schema")
    capability = str(payload.get("capability") or "").strip().lower()
    if capability not in SUPPORTED_CAPABILITIES:
        raise ValueError("unsupported_capability")
    body = payload.get("payload")
    if not isinstance(body, dict) or not body:
        raise ValueError("payload_required")
    policy = payload.get("policy") or {}
    if policy.get("owned_first") is not True or policy.get("no_tracking") is not True:
        raise ValueError("owned_privacy_policy_required")

    priority = max(0, min(100, int(payload.get("priority") or 50)))
    max_attempts = max(1, min(10, int(payload.get("max_attempts") or 3)))
    min_gpu_mb = max(0, min(262144, int(payload.get("min_gpu_mb") or 0)))
    request_key = str(payload.get("request_key") or "").strip()[:128] or None

    job_id = "mf_" + secrets.token_hex(12)
    job_token = secrets.token_urlsafe(32)
    now = now_ts()
    sealed = seal_json(body, job_id)

    with DB_LOCK, connect() as con:
        con.execute("BEGIN IMMEDIATE")
        con.execute(
            """
            INSERT INTO jobs(
              id,token_hash,capability,status,priority,created_at,updated_at,run_after,
              attempts,max_attempts,min_gpu_mb,payload_cipher,request_key
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                job_id, token_hash(job_token), capability, "queued", priority,
                now, now, now, 0, max_attempts, min_gpu_mb, sealed, request_key,
            ),
        )
        add_event(con, job_id, "queued", capability)
        con.execute("COMMIT")

    return {
        "id": job_id,
        "status": "queued",
        "deduplicated": False,
        "job_token": job_token,
        "capability": capability,
        "created_at": now,
    }


def register_worker(payload: dict[str, Any]) -> dict[str, Any]:
    worker_id = str(payload.get("worker_id") or "").strip()
    node_id = str(payload.get("node_id") or worker_id).strip()
    if not SAFE_WORKER.fullmatch(worker_id) or not SAFE_WORKER.fullmatch(node_id):
        raise ValueError("invalid_worker_id")
    caps = sorted({
        str(x).strip().lower()
        for x in (payload.get("capabilities") or [])
        if str(x).strip().lower() in SUPPORTED_CAPABILITIES
    })
    if not caps:
        raise ValueError("worker_capability_required")
    gpu = payload.get("gpu") if isinstance(payload.get("gpu"), dict) else {}
    labels = payload.get("labels") if isinstance(payload.get("labels"), dict) else {}
    max_jobs = max(1, min(32, int(payload.get("max_jobs") or 1)))
    version = str(payload.get("version") or "unknown")[:80]
    now = now_ts()

    with DB_LOCK, connect() as con:
        con.execute(
            """
            INSERT INTO workers(id,node_id,capabilities_json,gpu_json,labels_json,max_jobs,active_jobs,last_seen,registered_at,version)
            VALUES(?,?,?,?,?,?,0,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              node_id=excluded.node_id,
              capabilities_json=excluded.capabilities_json,
              gpu_json=excluded.gpu_json,
              labels_json=excluded.labels_json,
              max_jobs=excluded.max_jobs,
              last_seen=excluded.last_seen,
              version=excluded.version
            """,
            (
                worker_id, node_id, json.dumps(caps), json.dumps(gpu),
                json.dumps(labels), max_jobs, now, now, version,
            ),
        )
    return {"worker_id": worker_id, "registered": True, "capabilities": caps, "last_seen": now}


def worker_row(con: sqlite3.Connection, worker_id: str) -> sqlite3.Row:
    row = con.execute("SELECT * FROM workers WHERE id=?", (worker_id,)).fetchone()
    if not row:
        raise ValueError("worker_not_registered")
    return row


def heartbeat_worker(worker_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    if not SAFE_WORKER.fullmatch(worker_id):
        raise ValueError("invalid_worker_id")
    now = now_ts()
    with DB_LOCK, connect() as con:
        row = worker_row(con, worker_id)
        requeue_expired(con)
        gpu = payload.get("gpu") if isinstance(payload.get("gpu"), dict) else json.loads(row["gpu_json"])
        active = int(con.execute(
            "SELECT COUNT(*) AS n FROM jobs WHERE status='running' AND lease_owner=? AND lease_until>=?",
            (worker_id, now),
        ).fetchone()["n"])
        con.execute(
            "UPDATE workers SET gpu_json=?,active_jobs=?,last_seen=? WHERE id=?",
            (json.dumps(gpu), active, now, worker_id),
        )
    return {"worker_id": worker_id, "last_seen": now, "active_jobs": active}


def requeue_expired(con: sqlite3.Connection) -> int:
    now = now_ts()
    rows = con.execute(
        "SELECT id,attempts,max_attempts FROM jobs WHERE status='running' AND lease_until IS NOT NULL AND lease_until<?",
        (now,),
    ).fetchall()
    count = 0
    for row in rows:
        owner = con.execute("SELECT lease_owner FROM jobs WHERE id=?", (row["id"],)).fetchone()["lease_owner"]
        if int(row["attempts"]) >= int(row["max_attempts"]):
            con.execute(
                "UPDATE jobs SET status='failed',lease_owner=NULL,lease_until=NULL,updated_at=?,last_error=? WHERE id=?",
                (now, "lease_expired_max_attempts", row["id"]),
            )
            add_event(con, row["id"], "failed", "lease_expired_max_attempts")
        else:
            backoff = RETRY_BASE_SECONDS * (2 ** max(0, int(row["attempts"]) - 1))
            con.execute(
                "UPDATE jobs SET status='queued',lease_owner=NULL,lease_until=NULL,updated_at=?,run_after=?,last_error=? WHERE id=?",
                (now, now + backoff, "lease_expired", row["id"]),
            )
            add_event(con, row["id"], "requeued", "lease_expired")
        if owner:
            con.execute(
                "UPDATE workers SET active_jobs=CASE WHEN active_jobs>0 THEN active_jobs-1 ELSE 0 END WHERE id=?",
                (owner,),
            )
        count += 1
    return count


def claim_job(worker_id: str, lease_seconds: int | None = None) -> dict[str, Any] | None:
    if not SAFE_WORKER.fullmatch(worker_id):
        raise ValueError("invalid_worker_id")
    lease_seconds = max(30, min(3600, int(lease_seconds or DEFAULT_LEASE_SECONDS)))
    now = now_ts()

    with DB_LOCK, connect() as con:
        con.execute("BEGIN IMMEDIATE")
        requeue_expired(con)
        worker = worker_row(con, worker_id)
        if now - int(worker["last_seen"]) > WORKER_STALE_SECONDS:
            con.execute("ROLLBACK")
            raise ValueError("worker_heartbeat_stale")
        if int(worker["active_jobs"]) >= int(worker["max_jobs"]):
            con.execute("ROLLBACK")
            return None
        caps = json.loads(worker["capabilities_json"])
        gpu = json.loads(worker["gpu_json"])
        gpu_mem = int(gpu.get("memory_free_mb") or gpu.get("memory_mb") or 0)

        placeholders = ",".join("?" for _ in caps)
        params: list[Any] = [now, *caps, gpu_mem]
        row = con.execute(
            f"""
            SELECT * FROM jobs
            WHERE status='queued'
              AND run_after<=?
              AND capability IN ({placeholders})
              AND min_gpu_mb<=?
              AND attempts<max_attempts
            ORDER BY priority DESC, created_at ASC
            LIMIT 1
            """,
            params,
        ).fetchone()
        if not row:
            con.execute("COMMIT")
            return None

        until = now + lease_seconds
        con.execute(
            """
            UPDATE jobs
            SET status='running',lease_owner=?,lease_until=?,attempts=attempts+1,updated_at=?
            WHERE id=? AND status='queued'
            """,
            (worker_id, until, now, row["id"]),
        )
        con.execute(
            "UPDATE workers SET active_jobs=active_jobs+1,last_seen=? WHERE id=?",
            (now, worker_id),
        )
        add_event(con, row["id"], "claimed", worker_id)
        con.execute("COMMIT")

        fresh = dict(row)
        fresh["attempts"] = int(row["attempts"]) + 1
        fresh["lease_owner"] = worker_id
        fresh["lease_until"] = until
        return {
            "id": fresh["id"],
            "capability": fresh["capability"],
            "attempt": fresh["attempts"],
            "max_attempts": fresh["max_attempts"],
            "lease_until": until,
            "payload": unseal_json(fresh["payload_cipher"], fresh["id"]),
        }


def renew_lease(job_id: str, worker_id: str, lease_seconds: int | None = None) -> dict[str, Any]:
    if not SAFE_JOB.fullmatch(job_id) or not SAFE_WORKER.fullmatch(worker_id):
        raise ValueError("invalid_identity")
    lease_seconds = max(30, min(3600, int(lease_seconds or DEFAULT_LEASE_SECONDS)))
    now = now_ts()
    until = now + lease_seconds
    with DB_LOCK, connect() as con:
        cur = con.execute(
            """
            UPDATE jobs SET lease_until=?,updated_at=?
            WHERE id=? AND status='running' AND lease_owner=?
            """,
            (until, now, job_id, worker_id),
        )
        if cur.rowcount != 1:
            raise ValueError("lease_not_owned")
        con.execute("UPDATE workers SET last_seen=? WHERE id=?", (now, worker_id))
    return {"id": job_id, "lease_until": until}


def complete_job(job_id: str, worker_id: str, result: dict[str, Any]) -> dict[str, Any]:
    if not SAFE_JOB.fullmatch(job_id) or not SAFE_WORKER.fullmatch(worker_id):
        raise ValueError("invalid_identity")
    now = now_ts()
    sealed = seal_json(result, job_id + ":result")
    with DB_LOCK, connect() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute(
            "SELECT lease_owner,status FROM jobs WHERE id=?", (job_id,)
        ).fetchone()
        if not row or row["status"] != "running" or row["lease_owner"] != worker_id:
            con.execute("ROLLBACK")
            raise ValueError("lease_not_owned")
        con.execute(
            """
            UPDATE jobs SET status='complete',result_cipher=?,updated_at=?,
              lease_owner=NULL,lease_until=NULL,last_error=NULL
            WHERE id=?
            """,
            (sealed, now, job_id),
        )
        con.execute(
            "UPDATE workers SET active_jobs=CASE WHEN active_jobs>0 THEN active_jobs-1 ELSE 0 END,last_seen=? WHERE id=?",
            (now, worker_id),
        )
        add_event(con, job_id, "complete", worker_id)
        con.execute("COMMIT")
    return {"id": job_id, "status": "complete", "updated_at": now}


def fail_job(job_id: str, worker_id: str, error: str, retryable: bool = True) -> dict[str, Any]:
    if not SAFE_JOB.fullmatch(job_id) or not SAFE_WORKER.fullmatch(worker_id):
        raise ValueError("invalid_identity")
    now = now_ts()
    error = str(error or "worker_failed")[:500]
    with DB_LOCK, connect() as con:
        con.execute("BEGIN IMMEDIATE")
        row = con.execute(
            "SELECT status,lease_owner,attempts,max_attempts FROM jobs WHERE id=?", (job_id,)
        ).fetchone()
        if not row or row["status"] != "running" or row["lease_owner"] != worker_id:
            con.execute("ROLLBACK")
            raise ValueError("lease_not_owned")
        attempts = int(row["attempts"])
        can_retry = bool(retryable and attempts < int(row["max_attempts"]))
        if can_retry:
            backoff = RETRY_BASE_SECONDS * (2 ** max(0, attempts - 1))
            status = "queued"
            run_after = now + backoff
        else:
            status = "failed"
            run_after = now
        con.execute(
            """
            UPDATE jobs SET status=?,run_after=?,updated_at=?,lease_owner=NULL,lease_until=NULL,last_error=?
            WHERE id=?
            """,
            (status, run_after, now, error, job_id),
        )
        con.execute(
            "UPDATE workers SET active_jobs=CASE WHEN active_jobs>0 THEN active_jobs-1 ELSE 0 END,last_seen=? WHERE id=?",
            (now, worker_id),
        )
        add_event(con, job_id, status, error)
        con.execute("COMMIT")
    return {"id": job_id, "status": status, "run_after": run_after, "retryable": can_retry}


def artifact_path(job_id: str, name: str) -> Path:
    target = (ARTIFACT_ROOT / job_id / name).resolve()
    root = ARTIFACT_ROOT.resolve()
    if target == root or root not in target.parents:
        raise ValueError("invalid_artifact_path")
    return target


def save_artifact(job_id: str, worker_id: str, name: str, mime: str, data: bytes) -> dict[str, Any]:
    if not SAFE_JOB.fullmatch(job_id) or not SAFE_WORKER.fullmatch(worker_id) or not SAFE_ARTIFACT.fullmatch(name):
        raise ValueError("invalid_artifact_identity")
    if not data or len(data) > MAX_ARTIFACT_BYTES:
        raise ValueError("invalid_artifact_size")
    now = now_ts()
    with DB_LOCK, connect() as con:
        row = con.execute(
            "SELECT status,lease_owner FROM jobs WHERE id=?", (job_id,)
        ).fetchone()
        if not row or row["status"] != "running" or row["lease_owner"] != worker_id:
            raise ValueError("lease_not_owned")

    target = artifact_path(job_id, name)
    target.parent.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(target.suffix + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, target)
    digest = hashlib.sha256(data).hexdigest()
    artifact_id = "a_" + hashlib.sha256(f"{job_id}:{name}".encode()).hexdigest()[:24]
    relpath = str(target.relative_to(ARTIFACT_ROOT))

    with DB_LOCK, connect() as con:
        con.execute(
            """
            INSERT INTO artifacts(id,job_id,name,mime,relpath,sha256,bytes,created_at)
            VALUES(?,?,?,?,?,?,?,?)
            ON CONFLICT(job_id,name) DO UPDATE SET
              mime=excluded.mime,relpath=excluded.relpath,sha256=excluded.sha256,
              bytes=excluded.bytes,created_at=excluded.created_at
            """,
            (artifact_id, job_id, name, mime[:120], relpath, digest, len(data), now),
        )
        add_event(con, job_id, "artifact", f"{name}:{len(data)}")
    return {
        "id": artifact_id,
        "job_id": job_id,
        "name": name,
        "mime": mime,
        "sha256": digest,
        "bytes": len(data),
        "url": f"{ASSET_BASE_URL}/assets/{job_id}/{name}",
    }


def verify_job_token(job_id: str, token: str) -> bool:
    if not token:
        return False
    with connect() as con:
        row = con.execute("SELECT token_hash FROM jobs WHERE id=?", (job_id,)).fetchone()
    return bool(row and safe_equal(row["token_hash"], token_hash(token)))


def job_status(job_id: str) -> dict[str, Any] | None:
    if not SAFE_JOB.fullmatch(job_id):
        return None
    with DB_LOCK, connect() as con:
        requeue_expired(con)
        row = con.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if not row:
            return None
        artifacts = con.execute(
            "SELECT id,name,mime,sha256,bytes,created_at FROM artifacts WHERE job_id=? ORDER BY name",
            (job_id,),
        ).fetchall()
    result = unseal_json(row["result_cipher"], job_id + ":result") if row["result_cipher"] else None
    return {
        "id": row["id"],
        "capability": row["capability"],
        "status": row["status"],
        "priority": row["priority"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
        "attempts": row["attempts"],
        "max_attempts": row["max_attempts"],
        "run_after": row["run_after"],
        "lease_until": row["lease_until"],
        "last_error": row["last_error"],
        "result": result,
        "artifacts": [
            {
                "id": a["id"], "name": a["name"], "mime": a["mime"],
                "sha256": a["sha256"], "bytes": a["bytes"], "created_at": a["created_at"],
                "url": f"{ASSET_BASE_URL}/assets/{job_id}/{a['name']}",
            }
            for a in artifacts
        ],
    }


def health() -> dict[str, Any]:
    now = now_ts()
    db_ok = False
    counts: dict[str, int] = {}
    workers = 0
    try:
        with DB_LOCK, connect() as con:
            requeue_expired(con)
            con.execute("SELECT 1").fetchone()
            db_ok = True
            for row in con.execute("SELECT status,COUNT(*) AS n FROM jobs GROUP BY status"):
                counts[row["status"]] = int(row["n"])
            workers = int(con.execute(
                "SELECT COUNT(*) AS n FROM workers WHERE last_seen>=?", (now - WORKER_STALE_SECONDS,)
            ).fetchone()["n"])
    except Exception:
        db_ok = False
    key_ok = bool(INTERNAL_KEY)
    cipher_ok = False
    try:
        cipher_ok = len(payload_key()) == 32
    except Exception:
        pass
    return {
        "ok": bool(db_ok and key_ok and cipher_ok),
        "service": "izakhono-media-runtime-fabric",
        "version": "0.1",
        "queue": counts,
        "healthy_workers": workers,
        "durable_queue": db_ok,
        "encrypted_payloads_at_rest": cipher_ok,
        "artifact_root_ready": ARTIFACT_ROOT.exists(),
        "replicated_storage": REPLICATED_STORAGE,
        "production_ready": bool(db_ok and key_ok and cipher_ok and REPLICATED_STORAGE and workers > 0),
        "tracking": False,
        "raw_prompt_logging": False,
    }


def send_json(h: BaseHTTPRequestHandler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    h.send_response(status)
    h.send_header("content-type", "application/json; charset=utf-8")
    h.send_header("content-length", str(len(body)))
    h.send_header("cache-control", "no-store")
    h.send_header("x-content-type-options", "nosniff")
    h.send_header("referrer-policy", "no-referrer")
    h.end_headers()
    h.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoMediaFabric/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def authorized(self) -> bool:
        supplied = self.headers.get("x-izakhono-media-fabric-key", "")
        return bool(INTERNAL_KEY and supplied and safe_equal(supplied, INTERNAL_KEY))

    def read_json(self) -> dict[str, Any]:
        n = int(self.headers.get("content-length", "0") or "0")
        if n <= 0 or n > MAX_BODY:
            raise ValueError("invalid_body_size")
        value = json.loads(self.rfile.read(n).decode("utf-8"))
        if not isinstance(value, dict):
            raise ValueError("object_required")
        return value

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            h = health()
            return send_json(self, 200 if h["ok"] else 503, h)

        if path.startswith("/api/v1/jobs/"):
            if not self.authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            parts = path.strip("/").split("/")
            if len(parts) != 4:
                return send_json(self, 404, {"ok": False, "error": "not_found"})
            job_id = parts[-1]
            token = self.headers.get("x-izakhono-job-token", "")
            if not verify_job_token(job_id, token):
                return send_json(self, 403, {"ok": False, "error": "job_token_invalid"})
            status = job_status(job_id)
            if not status:
                return send_json(self, 404, {"ok": False, "error": "job_not_found"})
            return send_json(self, 200, {"ok": True, "job": status})

        if path.startswith("/assets/"):
            if not self.authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            parts = path.strip("/").split("/")
            if len(parts) != 3 or not SAFE_JOB.fullmatch(parts[1]) or not SAFE_ARTIFACT.fullmatch(parts[2]):
                return send_json(self, 404, {"ok": False, "error": "not_found"})
            target = artifact_path(parts[1], parts[2])
            if not target.is_file():
                return send_json(self, 404, {"ok": False, "error": "artifact_not_found"})
            mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
            size = target.stat().st_size
            self.send_response(200)
            self.send_header("content-type", mime)
            self.send_header("content-length", str(size))
            self.send_header("cache-control", "private, max-age=300")
            self.send_header("x-content-type-options", "nosniff")
            self.end_headers()
            with target.open("rb") as fh:
                while True:
                    chunk = fh.read(1024 * 1024)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
            return

        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_HEAD(self):
        path = urlparse(self.path).path
        if not path.startswith("/assets/") or not self.authorized():
            self.send_response(404); self.end_headers(); return
        parts = path.strip("/").split("/")
        if len(parts) != 3 or not SAFE_JOB.fullmatch(parts[1]) or not SAFE_ARTIFACT.fullmatch(parts[2]):
            self.send_response(404); self.end_headers(); return
        target = artifact_path(parts[1], parts[2])
        if not target.is_file():
            self.send_response(404); self.end_headers(); return
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("content-type", mime)
        self.send_header("content-length", str(target.stat().st_size))
        self.end_headers()

    def do_PUT(self):
        path = urlparse(self.path).path
        if not self.authorized():
            return send_json(self, 401, {"ok": False, "error": "unauthorized"})
        parts = path.strip("/").split("/")
        if len(parts) != 5 or parts[:3] != ["api", "v1", "artifacts"]:
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        job_id, name = parts[3], parts[4]
        worker_id = self.headers.get("x-izakhono-worker-id", "")
        try:
            n = int(self.headers.get("content-length", "0") or "0")
            if n <= 0 or n > MAX_ARTIFACT_BYTES:
                raise ValueError("invalid_artifact_size")
            data = self.rfile.read(n)
            if len(data) != n:
                raise ValueError("artifact_truncated")
            mime = str(self.headers.get("content-type") or "application/octet-stream")
            artifact = save_artifact(job_id, worker_id, name, mime, data)
            return send_json(self, 201, {"ok": True, "artifact": artifact})
        except ValueError as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)[:160]})
        except Exception as exc:
            return send_json(self, 500, {"ok": False, "error": "artifact_store_failed", "detail": str(exc)[:200]})

    def do_POST(self):
        path = urlparse(self.path).path
        if not self.authorized():
            return send_json(self, 401, {"ok": False, "error": "unauthorized"})
        try:
            payload = self.read_json()
        except Exception as exc:
            return send_json(self, 400, {"ok": False, "error": str(exc)[:120]})

        try:
            if path == "/api/v1/jobs":
                job = submit_job(payload)
                return send_json(self, 202, {"ok": True, "job": job})

            if path == "/api/v1/workers/register":
                worker = register_worker(payload)
                return send_json(self, 200, {"ok": True, "worker": worker})

            m = re.fullmatch(r"/api/v1/workers/([^/]+)/heartbeat", path)
            if m:
                worker = heartbeat_worker(m.group(1), payload)
                return send_json(self, 200, {"ok": True, "worker": worker})

            m = re.fullmatch(r"/api/v1/workers/([^/]+)/claim", path)
            if m:
                lease = int(payload.get("lease_seconds") or DEFAULT_LEASE_SECONDS)
                job = claim_job(m.group(1), lease)
                return send_json(self, 200, {"ok": True, "job": job})

            m = re.fullmatch(r"/api/v1/jobs/(mf_[a-f0-9]{24})/lease", path)
            if m:
                lease = renew_lease(m.group(1), str(payload.get("worker_id") or ""), payload.get("lease_seconds"))
                return send_json(self, 200, {"ok": True, "lease": lease})

            m = re.fullmatch(r"/api/v1/jobs/(mf_[a-f0-9]{24})/complete", path)
            if m:
                result = payload.get("result") if isinstance(payload.get("result"), dict) else {}
                done = complete_job(m.group(1), str(payload.get("worker_id") or ""), result)
                return send_json(self, 200, {"ok": True, "job": done})

            m = re.fullmatch(r"/api/v1/jobs/(mf_[a-f0-9]{24})/fail", path)
            if m:
                failed = fail_job(
                    m.group(1),
                    str(payload.get("worker_id") or ""),
                    str(payload.get("error") or "worker_failed"),
                    bool(payload.get("retryable", True)),
                )
                return send_json(self, 200, {"ok": True, "job": failed})

            return send_json(self, 404, {"ok": False, "error": "not_found"})
        except ValueError as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)[:160]})
        except Exception as exc:
            return send_json(self, 500, {"ok": False, "error": "fabric_operation_failed", "detail": str(exc)[:220]})


if __name__ == "__main__":
    if not INTERNAL_KEY:
        raise SystemExit("IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY is required")
    payload_key()
    init_db()
    print(f"IZAKHONO Media Runtime Fabric listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
