#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import secrets
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CONTROL_URL = os.getenv("IZAKHONO_CONTROL_URL", "http://127.0.0.1:9292").rstrip("/")
TOKEN_FILE = Path(os.getenv("IZAKHONO_CONTROL_TOKEN_FILE", "/etc/izakhono/control.owner-token"))
ENV_FILE = Path("/etc/izakhono/apps/izakhono-digital-finance.env")
TERMINAL = {"succeeded", "failed", "timed_out", "interrupted"}
SOURCE_FAILURE_MARKERS = (
    "does not appear to be a git repository",
    "could not read from remote repository",
    "repository not found",
    "no such file or directory",
    "fatal: repository",
    "unable to access 'file://",
)


def now() -> int:
    return int(time.time())


def git_head() -> str:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), "rev-parse", "HEAD"],
        text=True,
    ).strip()


def token() -> str:
    raw = os.getenv("IZAKHONO_CONTROL_TOKEN", "").strip()
    if raw:
        return raw
    if not TOKEN_FILE.is_file():
        raise RuntimeError(f"Owner token not found: {TOKEN_FILE}")
    raw = TOKEN_FILE.read_text(encoding="utf-8").strip()
    if not raw:
        raise RuntimeError("Owner token is empty")
    return raw


def control(method: str, path: str, payload=None, timeout: int = 30):
    body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode()
    headers = {"Authorization": f"Bearer {token()}"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(CONTROL_URL + path, data=body, method=method, headers=headers)
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read())


def local_probe(url: str, timeout: int = 8) -> dict:
    req = urllib.request.Request(url, method="GET", headers={"User-Agent": "IZAKHONO-DIGITAL-FINANCE-CUTOVER/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read(4096).decode("utf-8", "replace")
            return {"ok": 200 <= response.status < 400, "status": response.status, "body": body[:1000]}
    except urllib.error.HTTPError as exc:
        return {"ok": False, "status": exc.code, "error": "HTTPError"}
    except Exception as exc:
        return {"ok": False, "status": 0, "error": type(exc).__name__}


def ensure_env() -> dict:
    ENV_FILE.parent.mkdir(parents=True, exist_ok=True)
    created = False
    if not ENV_FILE.exists():
        created = True
        lines = [
            "IZAKHONO_DF_ADMIN_TOKEN=" + secrets.token_urlsafe(48),
            "IZAKHONO_DF_LEARNER_SIGNING_KEY=" + secrets.token_urlsafe(48),
            "IZAKHONO_DF_CREDENTIAL_SIGNING_KEY=" + secrets.token_urlsafe(48),
            "IZAKHONO_DF_STATE_DB=/data/izakhono-df.sqlite3",
        ]
        ENV_FILE.write_text("\n".join(lines) + "\n", encoding="utf-8")
        os.chmod(ENV_FILE, 0o600)
    else:
        os.chmod(ENV_FILE, 0o600)

    keys = set()
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        keys.add(line.split("=", 1)[0])
    required = {
        "IZAKHONO_DF_ADMIN_TOKEN",
        "IZAKHONO_DF_LEARNER_SIGNING_KEY",
        "IZAKHONO_DF_CREDENTIAL_SIGNING_KEY",
        "IZAKHONO_DF_STATE_DB",
    }
    missing = sorted(required - keys)
    if missing:
        raise RuntimeError("Missing required env keys: " + ", ".join(missing))
    return {"path": str(ENV_FILE), "created": created, "required_keys_present": True}


def source_failure(job: dict) -> bool:
    output = str(job.get("output") or "").lower()
    return any(marker in output for marker in SOURCE_FAILURE_MARKERS)


def poll(job_id: str, timeout: int = 2700) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = control("GET", f"/v1/jobs/{job_id}")
        if job.get("status") in TERMINAL:
            return job
        time.sleep(4)
    return {"id": job_id, "status": "timed_out", "output": "Polling timeout"}


def submit(profile: dict) -> dict:
    return control("POST", "/v1/deploy", profile)


def main() -> None:
    ap = argparse.ArgumentParser(description="Deploy IZAKHONO Digital Finance to NODE01")
    ap.add_argument("--report", default=str(ROOT / "IZAKHONO-DIGITAL-FINANCE-NODE01-REPORT.json"))
    ap.add_argument("--ref", default="")
    args = ap.parse_args()

    report = {
        "schema": "izakhono.digital.finance.node01.report.v1",
        "started_at": now(),
        "public_cutover_performed": False,
        "status_claim": "BUILT / VERIFIED LOCALLY",
        "app": "izakhono-digital-finance",
        "attempts": [],
    }

    try:
        node = control("GET", "/v1/node")
        report["node"] = node
        if not node.get("ready"):
            raise RuntimeError("IZAKHONO NODE01 is not ready")

        ref = (args.ref or git_head()).strip()
        if len(ref) != 40 or any(ch not in "0123456789abcdef" for ch in ref):
            raise RuntimeError("Production deployment requires a full immutable commit SHA")
        report["immutable_ref"] = ref

        report["host_env"] = ensure_env()

        base = {
            "repository": "izakhono-builder",
            "app": "izakhono-digital-finance",
            "ref": ref,
            "environment": "production",
            "mode": "single",
            "container_port": 8080,
            "health_path": "/healthz",
            "data_path": "/data",
            "dockerfile": "apps/izakhono-digital-finance/Dockerfile.node01",
            "env_file": str(ENV_FILE),
        }

        internal = dict(base)
        internal["source"] = "izakhono-code"
        queued = submit(internal)
        job = poll(queued["id"])
        report["attempts"].append({"source": "izakhono-code", "job": job})

        if job.get("status") != "succeeded":
            if not source_failure(job):
                report["overall"] = "FAILED_APPLICATION_OR_HEALTH_GATE"
                raise RuntimeError("Owned source reached NODE01 but application/build/health gate failed")
            mirror = dict(base)
            mirror["source"] = "github-mirror"
            queued = submit(mirror)
            mirror_job = poll(queued["id"])
            report["attempts"].append({"source": "github-mirror", "job": mirror_job})
            if mirror_job.get("status") != "succeeded":
                report["overall"] = "FAILED_GITHUB_MIRROR_FALLBACK"
                raise RuntimeError("Both IZAKHONO CODE and GitHub mirror deployment failed")
            report["deployed_source"] = "github-mirror"
        else:
            report["deployed_source"] = "izakhono-code"

        health = local_probe("http://127.0.0.1:8080/healthz")
        status = local_probe("http://127.0.0.1:8080/api/v1/status")
        report["local_health"] = health
        report["local_status"] = status

        if not health.get("ok") or health.get("body", "").strip() != "OK":
            raise RuntimeError("NODE01 product health check did not pass")
        if not status.get("ok") or "izakhono-digital-finance" not in status.get("body", ""):
            raise RuntimeError("NODE01 product status marker did not pass")

        report["overall"] = "PASS_LOCAL_OWNED"
        report["status_claim"] = "BUILT / VERIFIED LOCALLY"
        report["next_gate"] = "EDGE/DNS/TLS public verification"
    except Exception as exc:
        report.setdefault("overall", "STOPPED_SAFE")
        report["error"] = f"{type(exc).__name__}: {str(exc)[:700]}"
    finally:
        report["finished_at"] = now()
        Path(args.report).write_text(json.dumps(report, indent=2, sort_keys=True), encoding="utf-8")
        print(json.dumps(report, indent=2, sort_keys=True))

    raise SystemExit(0 if report.get("overall") == "PASS_LOCAL_OWNED" else 1)


if __name__ == "__main__":
    main()
