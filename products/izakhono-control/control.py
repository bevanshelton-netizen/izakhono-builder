#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import re
import secrets
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VERSION = "1.0.0"
HOST = os.getenv("IZAKHONO_CONTROL_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_CONTROL_PORT", "9292"))
TOKEN = os.getenv("IZAKHONO_CONTROL_TOKEN", "")
NODE = os.getenv("IZAKHONO_NODE_URL", "http://127.0.0.1:9191")
NODE_SECRET = os.getenv("IZAKHONO_NODE_SECRET", "")
CODE_REPOS = Path(os.getenv("IZAKHONO_CODE_REPOS", "/srv/izakhono-code/repos"))
ALLOW_GITHUB_MIRROR = os.getenv("IZAKHONO_ALLOW_GITHUB_MIRROR", "true").lower() == "true"

SAFE_SLUG = re.compile(r"^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$")
IMMUTABLE_SHA = re.compile(r"^[0-9a-f]{40}$")


def sign_headers(body=b""):
    ts = str(int(time.time()))
    nonce = secrets.token_hex(16)
    sig = hmac.new(
        NODE_SECRET.encode(),
        f"{ts}.{nonce}.".encode() + body,
        hashlib.sha256,
    ).hexdigest()
    return {
        "X-IZAKHONO-Timestamp": ts,
        "X-IZAKHONO-Nonce": nonce,
        "X-IZAKHONO-Signature": sig,
    }


def send_node(job):
    body = json.dumps(job, separators=(",", ":")).encode()
    headers = {"Content-Type": "application/json", **sign_headers(body)}
    req = urllib.request.Request(
        NODE.rstrip("/") + "/v1/jobs",
        data=body,
        method="POST",
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=20) as response:
        return response.status, json.loads(response.read())


def get_node(path):
    req = urllib.request.Request(
        NODE.rstrip("/") + path,
        method="GET",
        headers=sign_headers(b""),
    )
    with urllib.request.urlopen(req, timeout=10) as response:
        return response.status, json.loads(response.read())


def normalize_job(input_job):
    job = dict(input_job or {})
    source = str(job.pop("source", "izakhono-code"))
    repository = str(job.pop("repository", "")).strip()
    environment = str(job.get("environment") or "staging")

    if source == "izakhono-code":
        if not SAFE_SLUG.fullmatch(repository):
            raise ValueError("Invalid IZAKHONO CODE repository slug.")
        repo_path = (CODE_REPOS / f"{repository}.git").resolve()
        root = CODE_REPOS.resolve()
        if root not in repo_path.parents:
            raise ValueError("Unsafe IZAKHONO CODE repository path.")
        job["repo"] = "file://" + repo_path.as_posix()
    elif source == "github-mirror":
        if not ALLOW_GITHUB_MIRROR:
            raise ValueError("GitHub mirror source is disabled.")
        if not SAFE_SLUG.fullmatch(repository):
            raise ValueError("Invalid mirror repository slug.")
        job["repo"] = f"https://github.com/bevanshelton-netizen/{repository}.git"
    else:
        raise ValueError("Unsupported source. Use izakhono-code or github-mirror.")

    job["environment"] = environment
    ref = str(job.get("ref") or "")
    if environment == "production" and not IMMUTABLE_SHA.fullmatch(ref):
        raise ValueError("Production deployments require an immutable 40-character commit SHA.")

    if not job.get("idempotency_key"):
        seed = f"{job.get('app','')}:{environment}:{ref}:{job['repo']}"
        job["idempotency_key"] = hashlib.sha256(seed.encode()).hexdigest()[:32]

    return job


class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-CONTROL"

    def log_message(self, *args):
        pass

    def out(self, code, obj):
        body = json.dumps(obj, separators=(",", ":")).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authed(self):
        provided = self.headers.get("Authorization", "")
        expected = f"Bearer {TOKEN}"
        return bool(TOKEN) and hmac.compare_digest(provided, expected)

    def do_GET(self):
        if self.path == "/healthz":
            return self.out(200, {
                "ok": True,
                "service": "izakhono-control",
                "version": VERSION,
            })
        if not self.authed():
            return self.out(401, {"error": "unauthorized"})
        try:
            if self.path == "/v1/node":
                status, payload = get_node("/v1/node")
                return self.out(status, payload)
            if self.path == "/v1/status":
                status, payload = get_node("/v1/status")
                return self.out(status, payload)
            if self.path.startswith("/v1/jobs/"):
                job_id = self.path.rsplit("/", 1)[-1]
                status, payload = get_node(f"/v1/jobs/{job_id}")
                return self.out(status, payload)
        except Exception as exc:
            return self.out(502, {"error": "node_unreachable", "detail": str(exc)[:300]})
        return self.out(404, {"error": "not_found"})

    def do_POST(self):
        if self.path != "/v1/deploy":
            return self.out(404, {"error": "not_found"})
        if not self.authed():
            return self.out(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length < 2 or length > 65536:
                return self.out(413, {"error": "invalid_body_size"})
            raw = json.loads(self.rfile.read(length))
            job = normalize_job(raw)
        except ValueError as exc:
            return self.out(400, {"error": str(exc)})
        except Exception:
            return self.out(400, {"error": "invalid_json"})
        try:
            status, payload = send_node(job)
            return self.out(status, payload)
        except Exception as exc:
            return self.out(502, {"error": "node_unreachable", "detail": str(exc)[:300]})


def main():
    if not TOKEN or not NODE_SECRET:
        raise SystemExit("IZAKHONO_CONTROL_TOKEN and IZAKHONO_NODE_SECRET are required")
    print(f"IZAKHONO Control v{VERSION} listening on {HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
