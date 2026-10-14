#!/usr/bin/env python3
"""IZAKHONO Machine v1: deterministic worker handoffs and production state gates.

Standard-library only. The machine turns a production contract into a sequence of
verifiable handoffs. It never marks LIVE without the required evidence gates.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

STAGES = [
    "SOURCE", "PLAN", "BUILD", "VALIDATE", "PACKAGE", "REGISTER",
    "PROVISION", "DEPLOY", "HEALTH", "HTTPS", "ACCEPTANCE", "PROMOTE",
    "LIVE", "MONITOR"
]

OWNED_POLICY = "owned-first-externally-reversible"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def fail(message: str) -> None:
    print(f"[FAIL] {message}", file=sys.stderr)
    raise SystemExit(2)


def load(path: Path) -> dict:
    if not path.is_file():
        fail(f"Manifest not found: {path}")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        fail(f"Invalid JSON in {path}: {exc}")


def validate_manifest(data: dict) -> None:
    required = [
        "version", "name", "slug", "operator", "trading_name",
        "build_context", "dockerfile_path", "container_port", "health_path",
        "infrastructure"
    ]
    missing = [k for k in required if k not in data]
    if missing:
        fail("Missing manifest fields: " + ", ".join(missing))
    if int(data["version"]) != 3:
        fail("IZAKHONO manifest version 3 is required")
    slug = str(data["slug"])
    if not SLUG_RE.fullmatch(slug):
        fail("Unsafe application slug")
    infra = data["infrastructure"]
    if infra.get("policy") != OWNED_POLICY:
        fail("Owned-first policy is mandatory")
    if not str(infra.get("authoritative_source", "")).strip():
        fail("authoritative_source is required")
    if not str(infra.get("owned_target", "")).strip():
        fail("owned_target is required")
    for key in ("data_dependencies", "auth_dependencies", "payment_dependencies"):
        if not isinstance(infra.get(key), list):
            fail(f"infrastructure.{key} must be an array")
    for key in ("build_context", "dockerfile_path"):
        p = Path(str(data[key]).replace("\\", "/"))
        if p.is_absolute() or ".." in p.parts:
            fail(f"{key} must stay inside the repository")
        if key == "build_context" and not p.is_dir():
            fail(f"Build context missing: {p}")
        if key == "dockerfile_path" and not p.is_file():
            fail(f"Dockerfile missing: {p}")
    port = int(data["container_port"])
    if not 1 <= port <= 65535:
        fail("container_port out of range")
    health = str(data["health_path"])
    if not health.startswith("/"):
        fail("health_path must start with /")


def fingerprint(data: dict, source: str) -> str:
    canonical = json.dumps(data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256((canonical + source).encode()).hexdigest()[:20]


def handoff(job: str, app: str, run_id: str, source_stage: str, target: str,
            state: str, artifact: dict, acceptance: list[str], evidence: list[str],
            failure_owner: str, failure_action: str) -> dict:
    return {
        "api_version": "izakhono.worker-handoff/v1",
        "job": {"id": job, "application": app, "run_id": run_id},
        "from": source_stage,
        "to": target,
        "state": state,
        "artifact": artifact,
        "acceptance": acceptance,
        "evidence": evidence,
        "failure_route": {"owner": failure_owner, "action": failure_action},
        "created_at": int(time.time())
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["plan", "handoff", "gate"])
    parser.add_argument("--manifest", default=".izakhono.json")
    parser.add_argument("--stage", default="SOURCE")
    parser.add_argument("--state", default="READY")
    parser.add_argument("--artifact", default="manifest")
    parser.add_argument("--next", dest="next_worker", default="ARCHITECT")
    args = parser.parse_args()

    data = load(Path(args.manifest))
    validate_manifest(data)
    app = data["name"]
    source = os.environ.get("GITHUB_SHA", "local")
    run_id = os.environ.get("GITHUB_RUN_ID", "local")
    job_id = f"{data['slug']}-{fingerprint(data, source)}"

    if args.command == "plan":
        print(json.dumps({
            "api_version": "izakhono.machine/v1",
            "job": job_id,
            "application": app,
            "source": source,
            "stages": STAGES,
            "policy": OWNED_POLICY,
            "terminal_success": "LIVE",
            "failure_policy": "route-to-owner-then-retest",
        }, indent=2))
        return

    if args.command == "handoff":
        if args.stage not in STAGES:
            fail(f"Unknown stage: {args.stage}")
        artifact = {"kind": args.artifact, "version": source, "location": args.artifact}
        h = handoff(
            job_id, app, run_id, args.stage, args.next_worker, args.state, artifact,
            [f"{args.stage} gate passed", "artifact is addressable", "next worker can consume artifact"],
            [f"source={source}", f"stage={args.stage}"],
            args.stage,
            "repair the failed gate, create new evidence, and re-enter the same stage",
        )
        print(json.dumps(h, indent=2))
        return

    infra = data["infrastructure"]
    status = str(infra.get("status_label", ""))
    if status == "OWNED LIVE VERIFIED":
        route = str(infra.get("current_public_route", ""))
        if not route.startswith("https://"):
            fail("OWNED LIVE VERIFIED requires HTTPS")
        for key in ("backup_evidence", "restore_evidence", "rollback_evidence"):
            if str(infra.get(key, "")).strip().upper() in {"", "PENDING", "NOT_YET_VERIFIED", "NONE", "N/A"}:
                fail(f"OWNED LIVE VERIFIED requires {key}")
    print("[PASS] IZAKHONO Machine contract gate passed")
    print(json.dumps({"job": job_id, "application": app, "status": status, "next": "BUILD"}, indent=2))


if __name__ == "__main__":
    main()
