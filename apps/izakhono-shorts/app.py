#!/usr/bin/env python3
from __future__ import annotations

import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

from engine import APP_NAME, adapter_config, build_plan, list_jobs, load_job, new_job, save_job

HOST = os.getenv("IZAKHONO_SHORTS_HOST", "0.0.0.0")
PORT = int(os.getenv("IZAKHONO_SHORTS_PORT", "9710"))
ROOT = Path(__file__).resolve().parent
JOB_DIR = Path(os.getenv("IZAKHONO_SHORTS_JOB_DIR", str(ROOT / "data" / "jobs"))).resolve()
MAX_BODY = 2_000_000


def send_json(h, status, payload):
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    h.send_response(status)
    h.send_header("content-type", "application/json; charset=utf-8")
    h.send_header("content-length", str(len(body)))
    h.send_header("cache-control", "no-store")
    h.send_header("x-content-type-options", "nosniff")
    h.send_header("referrer-policy", "no-referrer")
    h.end_headers()
    h.wfile.write(body)


def send_file(h, path: Path, content_type: str):
    if not path.exists() or not path.is_file():
        return send_json(h, 404, {"ok": False, "error": "not_found"})
    body = path.read_bytes()
    h.send_response(200)
    h.send_header("content-type", content_type)
    h.send_header("content-length", str(len(body)))
    h.send_header("cache-control", "no-store")
    h.send_header("x-content-type-options", "nosniff")
    h.send_header("content-security-policy", "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'")
    h.end_headers()
    h.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoShorts/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def read_json(self):
        n = int(self.headers.get("content-length", "0") or "0")
        if n <= 0 or n > MAX_BODY:
            raise ValueError("invalid_body_size")
        return json.loads(self.rfile.read(n).decode("utf-8"))

    def do_GET(self):
        path = urlparse(self.path).path
        if path in {"/", "/index.html"}:
            return send_file(self, ROOT / "index.html", "text/html; charset=utf-8")
        if path == "/healthz":
            cfg = adapter_config()
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-shorts-factory",
                "name": APP_NAME,
                "version": "0.1.0",
                "owned_first": True,
                "tracking": False,
                "autopublish": False,
                "owned_renderer": cfg.owned_url,
                "owned_renderer_key_configured": bool(cfg.owned_key),
                "external_fallback_enabled": bool(cfg.allow_external and cfg.external_url),
            })
        if path == "/api/v1/jobs":
            return send_json(self, 200, {"ok": True, "jobs": list_jobs(JOB_DIR)})
        if path.startswith("/api/v1/jobs/"):
            jid = path.rsplit("/", 1)[-1]
            job = load_job(JOB_DIR, jid)
            if not job:
                return send_json(self, 404, {"ok": False, "error": "job_not_found"})
            return send_json(self, 200, {"ok": True, "job": job})
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
        except (ValueError, json.JSONDecodeError) as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)})

        if path == "/api/v1/plan":
            try:
                plan = build_plan(payload)
            except ValueError as exc:
                return send_json(self, 422, {"ok": False, "error": str(exc)})
            return send_json(self, 200, {"ok": True, "plan": plan})

        if path == "/api/v1/jobs":
            try:
                job = new_job(payload)
                save_job(JOB_DIR, job)
            except ValueError as exc:
                return send_json(self, 422, {"ok": False, "error": str(exc)})
            return send_json(self, 202, {
                "ok": True,
                "job": job,
                "message": "Queued for the IZAKHONO-owned renderer. Run worker.py continuously on NODE 01.",
            })

        return send_json(self, 404, {"ok": False, "error": "not_found"})


if __name__ == "__main__":
    JOB_DIR.mkdir(parents=True, exist_ok=True)
    print(f"{APP_NAME} listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
