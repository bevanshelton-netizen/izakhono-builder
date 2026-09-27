#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import time
from pathlib import Path

from engine import invoke_renderer, save_job

ROOT = Path(__file__).resolve().parent
JOB_DIR = Path(os.getenv("IZAKHONO_SHORTS_JOB_DIR", str(ROOT / "data" / "jobs"))).resolve()
POLL_SECONDS = max(1, int(os.getenv("IZAKHONO_SHORTS_POLL_SECONDS", "3")))
RETRY_SECONDS = max(5, int(os.getenv("IZAKHONO_SHORTS_RENDER_RETRY_SECONDS", "30")))


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def process_one(path: Path) -> bool:
    try:
        job = load(path)
    except Exception:
        return False
    status = job.get("status")
    if status not in {"queued", "waiting_renderer"}:
        return False
    if status == "waiting_renderer" and int(job.get("updated_at") or 0) + RETRY_SECONDS > int(time.time()):
        return False

    job["status"] = "rendering"
    job["attempts"] = int(job.get("attempts") or 0) + 1
    job["updated_at"] = int(time.time())
    save_job(JOB_DIR, job)

    try:
        route, result = invoke_renderer(job)
        job["status"] = "complete"
        job["route"] = route
        job["render"] = result
        job["error"] = None
    except Exception as exc:
        msg = str(exc)[:500]
        if msg.startswith("owned_renderer_unavailable:"):
            job["status"] = "waiting_renderer"
        else:
            job["status"] = "failed"
        job["error"] = msg
    job["updated_at"] = int(time.time())
    save_job(JOB_DIR, job)
    return True


def sweep() -> int:
    JOB_DIR.mkdir(parents=True, exist_ok=True)
    count = 0
    for path in sorted(JOB_DIR.glob("shorts_*.json"), key=lambda p: p.stat().st_mtime):
        if process_one(path):
            count += 1
    return count


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Process queued jobs once, then exit")
    args = parser.parse_args()
    if args.once:
        print(f"processed={sweep()}")
        return
    print("IZAKHONO SHORTS worker started")
    while True:
        sweep()
        time.sleep(POLL_SECONDS)


if __name__ == "__main__":
    main()
