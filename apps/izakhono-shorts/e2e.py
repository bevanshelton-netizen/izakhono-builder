#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

DEFAULT_BASE = "http://127.0.0.1:9710"


def http_json(url: str, payload: dict[str, Any] | None = None, timeout: int = 30) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"accept": "application/json", **({"content-type": "application/json"} if body is not None else {})},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def head_asset(url: str, timeout: int = 30) -> dict[str, Any]:
    req = urllib.request.Request(url, method="HEAD")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return {
            "status": int(res.status),
            "content_type": str(res.headers.get("content-type") or "").lower(),
            "content_length": int(res.headers.get("content-length") or "0"),
        }


def download(url: str, path: Path, timeout: int = 300) -> tuple[int, str]:
    h = hashlib.sha256()
    size = 0
    with urllib.request.urlopen(url, timeout=timeout) as res, path.open("wb") as out:
        while True:
            chunk = res.read(1024 * 1024)
            if not chunk:
                break
            out.write(chunk)
            h.update(chunk)
            size += len(chunk)
    return size, h.hexdigest()


def mp4_signature_ok(path: Path) -> bool:
    if not path.exists() or path.stat().st_size < 4096:
        return False
    with path.open("rb") as fh:
        head = fh.read(64)
    return b"ftyp" in head


def manifest_ok(manifest: dict[str, Any]) -> tuple[bool, list[str]]:
    errors: list[str] = []
    if manifest.get("schema") != "izakhono.shorts.asset.v1":
        errors.append("manifest_schema")
    if manifest.get("route") != "owned":
        errors.append("manifest_route")
    if manifest.get("renderer") != "izakhono-shorts-renderer":
        errors.append("manifest_renderer")
    policy = manifest.get("policy") or {}
    if policy.get("no_tracking") is not True:
        errors.append("tracking_policy")
    if policy.get("autopublish") is not False:
        errors.append("autopublish_policy")
    output = manifest.get("output") or {}
    if output.get("container") != "mp4":
        errors.append("output_container")
    if int(output.get("width") or 0) != 1080 or int(output.get("height") or 0) != 1920:
        errors.append("output_dimensions")
    if int(output.get("fps") or 0) != 30:
        errors.append("output_fps")
    if float(manifest.get("duration_seconds") or 0) < 5:
        errors.append("duration")
    scenes = manifest.get("scenes") or []
    if not isinstance(scenes, list) or not scenes:
        errors.append("scenes")
    return not errors, errors


def run_e2e(base: str, evidence_dir: Path, timeout_seconds: int, poll_seconds: int) -> dict[str, Any]:
    evidence_dir.mkdir(parents=True, exist_ok=True)
    started = int(time.time())
    report: dict[str, Any] = {
        "schema": "izakhono.shorts.e2e.v1",
        "started_at": started,
        "base_url": base,
        "owned_first": True,
        "tracking": False,
        "autopublish": False,
        "live_claim_allowed": False,
        "ok": False,
    }

    health = http_json(base.rstrip("/") + "/healthz", timeout=10)
    report["factory_health"] = health
    if health.get("ok") is not True:
        raise RuntimeError("factory_health_failed")
    if health.get("external_fallback_enabled") is True:
        raise RuntimeError("external_fallback_must_be_off_for_e2e_gate")
    if health.get("owned_renderer_key_configured") is not True:
        raise RuntimeError("owned_renderer_key_missing")

    payload = {
        "title": "IZAKHONO First Owned Short",
        "prompt": (
            "Create an original educational micro-story explaining why the moon appears to change shape. "
            "Use an original young explorer character, calm pacing, clear visual storytelling and no copyrighted characters."
        ),
        "audience": "education",
        "language": "English",
        "style": "bright cinematic original 3D animation",
        "duration_seconds": 15,
        "original_only": True,
    }
    queued = http_json(base.rstrip("/") + "/api/v1/jobs", payload, timeout=15)
    if queued.get("ok") is not True:
        raise RuntimeError("queue_failed:" + str(queued.get("error") or "unknown"))
    job = queued.get("job") or {}
    job_id = str(job.get("id") or "")
    if not job_id.startswith("shorts_"):
        raise RuntimeError("invalid_job_id")
    report["job_id"] = job_id

    deadline = time.time() + max(60, timeout_seconds)
    history: list[dict[str, Any]] = []
    final_job: dict[str, Any] | None = None
    while time.time() < deadline:
        snapshot = http_json(base.rstrip("/") + "/api/v1/jobs/" + job_id, timeout=10)
        current = snapshot.get("job") or {}
        status = str(current.get("status") or "unknown")
        history.append({"at": int(time.time()), "status": status, "attempts": current.get("attempts"), "route": current.get("route")})
        if status == "complete":
            final_job = current
            break
        if status == "failed":
            raise RuntimeError("render_failed:" + str(current.get("error") or "unknown"))
        time.sleep(max(1, poll_seconds))
    if final_job is None:
        raise TimeoutError("e2e_render_timeout")

    report["job_history"] = history[-120:]
    report["job"] = {
        "status": final_job.get("status"),
        "route": final_job.get("route"),
        "attempts": final_job.get("attempts"),
        "error": final_job.get("error"),
    }
    if final_job.get("route") != "owned":
        raise RuntimeError("non_owned_route")

    render = final_job.get("render") or {}
    asset = render.get("asset") or {}
    captions = render.get("captions") or {}
    manifest_ref = render.get("manifest") or {}
    asset_url = str(asset.get("url") or "")
    captions_url = str(captions.get("url") or "")
    manifest_url = str(manifest_ref.get("url") or "")
    if not asset_url or not captions_url or not manifest_url:
        raise RuntimeError("render_artifact_links_missing")

    head = head_asset(asset_url, timeout=20)
    report["asset_head"] = head
    if head["status"] != 200 or "video/mp4" not in head["content_type"] or head["content_length"] < 4096:
        raise RuntimeError("mp4_head_validation_failed")

    mp4_path = evidence_dir / "IZAKHONO-FIRST-OWNED-SHORT.mp4"
    captions_path = evidence_dir / "IZAKHONO-FIRST-OWNED-SHORT.vtt"
    manifest_path = evidence_dir / "IZAKHONO-FIRST-OWNED-SHORT-manifest.json"

    size, sha256 = download(asset_url, mp4_path, timeout=600)
    if size < 4096 or not mp4_signature_ok(mp4_path):
        raise RuntimeError("mp4_binary_validation_failed")
    download(captions_url, captions_path, timeout=60)
    download(manifest_url, manifest_path, timeout=60)
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    valid_manifest, manifest_errors = manifest_ok(manifest)
    if not valid_manifest:
        raise RuntimeError("manifest_validation_failed:" + ",".join(manifest_errors))

    report["artifacts"] = {
        "video": {"path": str(mp4_path), "bytes": size, "sha256": sha256},
        "captions": {"path": str(captions_path)},
        "manifest": {"path": str(manifest_path)},
    }
    report["manifest_summary"] = {
        "duration_seconds": manifest.get("duration_seconds"),
        "scene_count": len(manifest.get("scenes") or []),
        "speech_routes": manifest.get("speech_routes"),
        "motion_routes": manifest.get("motion_routes"),
        "output": manifest.get("output"),
    }
    report["ok"] = True
    report["live_claim_allowed"] = True
    report["completed_at"] = int(time.time())
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a real owned IZAKHONO Shorts render and gate LIVE status on the resulting MP4.")
    parser.add_argument("--base", default=DEFAULT_BASE)
    parser.add_argument("--evidence-dir", default="/evidence")
    parser.add_argument("--timeout", type=int, default=2400)
    parser.add_argument("--poll", type=int, default=5)
    args = parser.parse_args()

    evidence_dir = Path(args.evidence_dir).resolve()
    report_path = evidence_dir / "IZAKHONO-SHORTS-E2E-REPORT.json"
    try:
        report = run_e2e(args.base, evidence_dir, args.timeout, args.poll)
        evidence_dir.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(json.dumps(report, indent=2, ensure_ascii=False))
        return 0
    except Exception as exc:
        evidence_dir.mkdir(parents=True, exist_ok=True)
        failure = {
            "schema": "izakhono.shorts.e2e.v1",
            "ok": False,
            "live_claim_allowed": False,
            "error": str(exc)[:1000],
            "completed_at": int(time.time()),
        }
        report_path.write_text(json.dumps(failure, indent=2), encoding="utf-8")
        print(json.dumps(failure, indent=2))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
