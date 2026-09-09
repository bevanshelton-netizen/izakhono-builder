#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import queue
import re
import secrets
import shutil
import socket
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VERSION = "1.0.0"
HOST = os.getenv("IZAKHONO_NODE_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_NODE_PORT", "9191"))
SECRET = os.getenv("IZAKHONO_NODE_SECRET", "")
ROOT = Path(os.getenv("IZAKHONO_NODE_ROOT", "/var/lib/izakhono-node"))
DEPLOYER = os.getenv("IZAKHONO_NODE_DEPLOYER", "/opt/izakhono-node/deploy.sh")
NODE_ID = os.getenv("IZAKHONO_NODE_ID", socket.gethostname() or "izakhono-node")
MAX_SKEW = int(os.getenv("IZAKHONO_NODE_MAX_SKEW", "300"))
JOB_TIMEOUT = int(os.getenv("IZAKHONO_NODE_JOB_TIMEOUT", "2700"))
ALLOWED_REPO_PREFIXES = tuple(
    p.strip()
    for p in os.getenv(
        "IZAKHONO_NODE_ALLOWED_REPO_PREFIXES",
        "file:///srv/izakhono-code/repos/;https://github.com/bevanshelton-netizen/",
    ).split(";")
    if p.strip()
)

ROOT.mkdir(parents=True, exist_ok=True)
JOBS_DIR = ROOT / "jobs"
EVIDENCE_DIR = ROOT / "evidence"
JOBS_DIR.mkdir(exist_ok=True)
EVIDENCE_DIR.mkdir(exist_ok=True)

jobs = {}
idempotency = {}
nonces = {}
job_queue = queue.Queue()
_worker_thread = None

SAFE_APP = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{1,62}[A-Za-z0-9]$")
SAFE_REF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/-]{0,199}$")
SAFE_KEY = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$")
IMMUTABLE_SHA = re.compile(r"^[0-9a-f]{40}$")
SAFE_RELATIVE = re.compile(r"^[A-Za-z0-9._/-]+$")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def atomic_write(path, text):
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(text)
    os.replace(temp, path)


def persist_job(record):
    atomic_write(JOBS_DIR / f"{record['id']}.json", json.dumps(record, indent=2, sort_keys=True))


def load_jobs():
    for file in sorted(JOBS_DIR.glob("job_*.json")):
        try:
            record = json.loads(file.read_text())
        except Exception:
            continue
        if record.get("status") in ("queued", "running"):
            record["status"] = "interrupted"
            record["finished_at"] = int(time.time())
            record["output"] = "Node restarted before this job completed."
            persist_job(record)
        jid = record.get("id")
        if jid:
            jobs[jid] = record
            key = record.get("idempotency_key")
            if key:
                idempotency[key] = jid


def clean_nonces():
    cutoff = time.time() - MAX_SKEW
    for nonce, stamp in list(nonces.items()):
        if stamp < cutoff:
            nonces.pop(nonce, None)


def verify(headers, body=b""):
    if not SECRET:
        return False, "node secret not configured"
    ts = headers.get("X-IZAKHONO-Timestamp", "")
    nonce = headers.get("X-IZAKHONO-Nonce", "")
    sig = headers.get("X-IZAKHONO-Signature", "")
    try:
        stamp = int(ts)
    except Exception:
        return False, "bad timestamp"
    if abs(int(time.time()) - stamp) > MAX_SKEW:
        return False, "expired request"
    clean_nonces()
    if not nonce or nonce in nonces:
        return False, "replayed request"
    expected = hmac.new(
        SECRET.encode(),
        f"{ts}.{nonce}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, sig):
        return False, "bad signature"
    nonces[nonce] = time.time()
    return True, ""


def safe_relative(value):
    value = str(value or "")
    return bool(
        value
        and SAFE_RELATIVE.fullmatch(value)
        and not value.startswith("/")
        and ".." not in Path(value).parts
        and "\\" not in value
    )


def repo_allowed(repo):
    repo = str(repo or "")
    if not any(repo.startswith(prefix) for prefix in ALLOWED_REPO_PREFIXES):
        return False
    if repo.startswith("file:///srv/izakhono-code/repos/"):
        return repo.endswith(".git") and ".." not in repo
    if repo.startswith("https://github.com/bevanshelton-netizen/"):
        return repo.endswith(".git") and ".." not in repo
    return True


def valid_job(job):
    mode = str(job.get("mode") or "single")
    environment = str(job.get("environment") or "staging")
    if mode not in ("single", "compose"):
        return False, "invalid mode"
    if environment not in ("staging", "production"):
        return False, "invalid environment"

    for key in ("app", "repo", "ref"):
        if not job.get(key):
            return False, f"missing required field: {key}"

    if not SAFE_APP.fullmatch(str(job["app"])):
        return False, "invalid app"
    if not repo_allowed(job["repo"]):
        return False, "repo is not on the IZAKHONO allow-list"

    ref = str(job["ref"])
    if environment == "production":
        if not IMMUTABLE_SHA.fullmatch(ref):
            return False, "production ref must be an immutable 40-character commit SHA"
    elif not SAFE_REF.fullmatch(ref) or ".." in ref:
        return False, "invalid ref"

    key = str(job.get("idempotency_key") or "")
    if key and not SAFE_KEY.fullmatch(key):
        return False, "invalid idempotency_key"

    public_url = str(job.get("public_url") or "")
    if public_url and not public_url.startswith("https://"):
        return False, "public_url must use HTTPS"

    dockerfile = str(job.get("dockerfile") or "Dockerfile")
    if not safe_relative(dockerfile):
        return False, "invalid dockerfile"

    if mode == "single":
        if not job.get("container_port") or not job.get("health_path"):
            return False, "missing single-service field"
        if not str(job["health_path"]).startswith("/"):
            return False, "invalid health path"
        try:
            port = int(job["container_port"])
            if port < 1 or port > 65535:
                return False, "invalid container port"
        except Exception:
            return False, "invalid container port"
    else:
        compose_file = str(job.get("compose_file") or "")
        health = str(job.get("health_url") or "")
        if not safe_relative(compose_file) or not health:
            return False, "missing or invalid compose-service field"
        if not health.startswith((
            "http://127.0.0.1:",
            "http://localhost:",
            "https://127.0.0.1:",
            "https://localhost:",
        )):
            return False, "compose health_url must be localhost"

    env_file = str(job.get("env_file") or "")
    if env_file:
        resolved = Path(env_file).resolve().as_posix()
        if not resolved.startswith("/etc/izakhono/apps/"):
            return False, "env_file must live under /etc/izakhono/apps"

    public_build_env_file = str(job.get("public_build_env_file") or "")
    if public_build_env_file:
        resolved = Path(public_build_env_file).resolve().as_posix()
        if not resolved.startswith("/etc/izakhono/apps/"):
            return False, "public_build_env_file must live under /etc/izakhono/apps"

    return True, ""


def node_ready():
    if not SECRET:
        return False, "node secret not configured"
    if not Path(DEPLOYER).is_file():
        return False, "deployer missing"
    if not os.access(DEPLOYER, os.X_OK):
        return False, "deployer not executable"
    if shutil.which("docker") is None:
        return False, "docker missing"
    try:
        result = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=4,
        )
        if result.returncode != 0:
            return False, "docker unavailable"
    except Exception:
        return False, "docker unavailable"
    return True, ""


def write_proof(record, job):
    proof = {
        "proof_version": 1,
        "node_id": NODE_ID,
        "job_id": record["id"],
        "app": record["app"],
        "environment": record["environment"],
        "repo": job["repo"],
        "requested_ref": job["ref"],
        "status": record["status"],
        "returncode": record.get("returncode"),
        "created_at": record.get("created_at"),
        "started_at": record.get("started_at"),
        "finished_at": record.get("finished_at"),
        "job_sha256": hashlib.sha256(canonical(job)).hexdigest(),
        "output_sha256": hashlib.sha256(record.get("output", "").encode()).hexdigest(),
    }
    proof["signature_hmac_sha256"] = hmac.new(
        SECRET.encode(), canonical(proof), hashlib.sha256
    ).hexdigest()
    path = EVIDENCE_DIR / f"{record['id']}.proof.json"
    atomic_write(path, json.dumps(proof, indent=2, sort_keys=True))
    record["proof_path"] = str(path)
    record["proof_sha256"] = hashlib.sha256(path.read_bytes()).hexdigest()
    persist_job(record)


def worker():
    while True:
        jid, job = job_queue.get()
        record = jobs[jid]
        record["status"] = "running"
        record["started_at"] = int(time.time())
        persist_job(record)
        try:
            process = subprocess.run(
                [DEPLOYER, json.dumps(job, separators=(",", ":"))],
                text=True,
                capture_output=True,
                timeout=JOB_TIMEOUT,
            )
            output = (process.stdout + process.stderr)[-20000:]
            record.update(
                status="succeeded" if process.returncode == 0 else "failed",
                finished_at=int(time.time()),
                returncode=process.returncode,
                output=output,
            )
        except subprocess.TimeoutExpired as exc:
            output = ((exc.stdout or "") + (exc.stderr or ""))[-20000:]
            record.update(
                status="timed_out",
                finished_at=int(time.time()),
                returncode=124,
                output=output + "\nDeployment exceeded the IZAKHONO Node job timeout.",
            )
        except Exception as exc:
            record.update(
                status="failed",
                finished_at=int(time.time()),
                returncode=125,
                output=f"Node execution error: {str(exc)[:1000]}",
            )
        persist_job(record)
        write_proof(record, job)
        job_queue.task_done()


def start_worker():
    global _worker_thread
    if _worker_thread and _worker_thread.is_alive():
        return
    _worker_thread = threading.Thread(target=worker, daemon=True, name="izakhono-node-worker")
    _worker_thread.start()


class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-NODE"

    def log_message(self, *args):
        pass

    def send_json(self, code, obj):
        data = json.dumps(obj, separators=(",", ":")).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def require_signed_get(self):
        ok, err = verify(self.headers, b"")
        if not ok:
            self.send_json(401, {"error": err})
            return False
        return True

    def do_GET(self):
        if self.path == "/healthz":
            return self.send_json(200, {
                "ok": True,
                "service": "izakhono-node",
                "version": VERSION,
                "node_id": NODE_ID,
            })
        if self.path == "/readyz":
            ready, reason = node_ready()
            return self.send_json(200 if ready else 503, {
                "ok": ready,
                "service": "izakhono-node",
                "version": VERSION,
                "node_id": NODE_ID,
                "reason": reason or "ready",
            })
        if not self.require_signed_get():
            return
        if self.path == "/v1/node":
            ready, reason = node_ready()
            return self.send_json(200, {
                "node_id": NODE_ID,
                "version": VERSION,
                "ready": ready,
                "reason": reason or "ready",
                "queued": job_queue.qsize(),
                "allowed_repo_prefixes": ALLOWED_REPO_PREFIXES,
                "capabilities": [
                    "signed_jobs",
                    "immutable_production_refs",
                    "izakhono_code_source",
                    "docker_canary",
                    "rollback",
                    "compose",
                    "public_build_env",
                    "deployment_proof",
                ],
            })
        if self.path == "/v1/status":
            ordered = sorted(jobs.values(), key=lambda x: x.get("created_at", 0))
            return self.send_json(200, {
                "ok": True,
                "node_id": NODE_ID,
                "queued": job_queue.qsize(),
                "jobs": ordered[-20:],
            })
        if self.path.startswith("/v1/jobs/"):
            jid = self.path.rsplit("/", 1)[-1]
            return self.send_json(200, jobs[jid]) if jid in jobs else self.send_json(404, {"error": "not_found"})
        return self.send_json(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/v1/jobs":
            return self.send_json(404, {"error": "not_found"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except Exception:
            return self.send_json(400, {"error": "invalid_content_length"})
        if length < 2 or length > 65536:
            return self.send_json(413, {"error": "invalid_body_size"})
        body = self.rfile.read(length)
        ok, err = verify(self.headers, body)
        if not ok:
            return self.send_json(401, {"error": err})
        try:
            job = json.loads(body)
        except Exception:
            return self.send_json(400, {"error": "invalid_json"})
        ok, err = valid_job(job)
        if not ok:
            return self.send_json(400, {"error": err})

        idem = str(job.get("idempotency_key") or "")
        if idem and idem in idempotency:
            existing = jobs.get(idempotency[idem])
            if existing:
                return self.send_json(200, existing)

        jid = f"job_{int(time.time())}_{secrets.token_hex(6)}"
        record = {
            "id": jid,
            "node_id": NODE_ID,
            "app": job["app"],
            "ref": job["ref"],
            "environment": str(job.get("environment") or "staging"),
            "mode": str(job.get("mode") or "single"),
            "idempotency_key": idem or None,
            "status": "queued",
            "created_at": int(time.time()),
        }
        jobs[jid] = record
        if idem:
            idempotency[idem] = jid
        persist_job(record)
        job_queue.put((jid, job))
        return self.send_json(202, record)


def main():
    if not SECRET:
        raise SystemExit("IZAKHONO_NODE_SECRET is required")
    load_jobs()
    start_worker()
    print(f"IZAKHONO Node v{VERSION} [{NODE_ID}] listening on {HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
