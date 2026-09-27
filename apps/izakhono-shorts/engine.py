#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import os
import re
import time
import urllib.request
import urllib.error
from dataclasses import dataclass
from pathlib import Path
from typing import Any

APP_NAME = "IZAKHONO SHORTS FACTORY"
SCHEMA = "izakhono.shorts.job.v1"
DEFAULT_SCENES = 8

KIDS_BLOCKLIST = {
    "gore", "graphic violence", "suicide", "self-harm", "sexual content",
    "porn", "drug use", "torture", "decapitation", "jump scare",
}
COPYCAT_MARKERS = {
    "disney", "pixar", "marvel", "peppa pig", "cocomelon", "paw patrol",
    "mickey mouse", "spiderman", "frozen", "barbie",
}


def now_ts() -> int:
    return int(time.time())


def slugify(value: str, max_len: int = 56) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return (value or "short")[:max_len]


def stable_id(seed: str) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[:16]


def clean_text(value: Any, limit: int) -> str:
    return str(value or "").strip()[:limit]


def policy_check(prompt: str, audience: str, original_only: bool) -> dict[str, Any]:
    low = prompt.lower()
    flags: list[str] = []
    if audience == "kids":
        for term in sorted(KIDS_BLOCKLIST):
            if term in low:
                flags.append(f"kids_safety:{term}")
    if original_only:
        for term in sorted(COPYCAT_MARKERS):
            if term in low:
                flags.append(f"originality_review:{term}")
    return {
        "ok": not flags,
        "flags": flags,
        "kids_mode": audience == "kids",
        "original_only": bool(original_only),
        "made_for_kids_required": audience == "kids",
    }


def make_scene(index: int, total: int, topic: str, style: str, language: str, audience: str) -> dict[str, Any]:
    beats = [
        "Hook with a clear curiosity gap",
        "Introduce the original lead character and goal",
        "Show the first discovery or challenge",
        "Escalate with a visual change or new clue",
        "Teach or reveal the key idea",
        "Give the character a small choice or action",
        "Resolve the story with a satisfying payoff",
        "Close with a memorable recap and gentle call to continue",
    ]
    beat = beats[(index - 1) % len(beats)]
    seconds = 7 if total >= 8 else 9
    narration = f"Scene {index}: {beat}. Topic: {topic}."
    if audience == "kids":
        narration += " Keep the language warm, simple, calm and age-appropriate."
    return {
        "index": index,
        "duration_seconds": seconds,
        "beat": beat,
        "narration": narration,
        "visual_prompt": (
            f"Original character, {style} visual style, vertical 9:16 composition. "
            f"{beat}. Story topic: {topic}. Consistent character design, expressive but safe, "
            f"clean background separation, cinematic lighting, no logos, no copyrighted characters."
        ),
        "language": language,
    }


def build_plan(payload: dict[str, Any]) -> dict[str, Any]:
    prompt = clean_text(payload.get("prompt"), 4000)
    if not prompt:
        raise ValueError("prompt_required")
    audience = clean_text(payload.get("audience") or "general", 20).lower()
    if audience not in {"kids", "general", "education", "brand"}:
        raise ValueError("invalid_audience")
    language = clean_text(payload.get("language") or "English", 60)
    style = clean_text(payload.get("style") or "bright cinematic 3D animation", 120)
    duration = int(payload.get("duration_seconds") or 60)
    duration = max(15, min(duration, 180))
    scene_count = max(4, min(20, round(duration / 7.5)))
    original_only = bool(payload.get("original_only", True))
    check = policy_check(prompt, audience, original_only)
    if not check["ok"]:
        raise ValueError("policy_review_required:" + ",".join(check["flags"]))

    topic = prompt.rstrip(". ")
    title = clean_text(payload.get("title") or topic.split("\n", 1)[0], 100)
    scenes = [make_scene(i, scene_count, topic, style, language, audience) for i in range(1, scene_count + 1)]
    total_seconds = sum(s["duration_seconds"] for s in scenes)

    return {
        "schema": "izakhono.shorts.plan.v1",
        "title": title,
        "slug": slugify(title),
        "prompt": prompt,
        "audience": audience,
        "language": language,
        "style": style,
        "aspect_ratio": "9:16",
        "target_duration_seconds": duration,
        "planned_duration_seconds": total_seconds,
        "policy": check,
        "character_bible": {
            "rule": "Use original characters only unless the operator supplies rights-cleared assets.",
            "consistency": "Preserve face, hair, clothing palette, proportions and age presentation across scenes.",
            "safety": "No frightening faces, sudden jump scares or unsafe imitation prompts in kids mode.",
        },
        "scenes": scenes,
        "publishing": {
            "youtube_shorts": True,
            "made_for_kids": audience == "kids",
            "comments_expected_disabled": audience == "kids",
            "autopublish": False,
        },
    }


@dataclass
class AdapterConfig:
    owned_url: str
    owned_key: str
    external_url: str
    external_key: str
    allow_external: bool


def adapter_config() -> AdapterConfig:
    return AdapterConfig(
        owned_url=os.getenv("IZAKHONO_SHORTS_RENDER_URL", "http://127.0.0.1:9721").rstrip("/"),
        owned_key=os.getenv("IZAKHONO_SHORTS_RENDER_KEY", ""),
        external_url=os.getenv("IZAKHONO_SHORTS_EXTERNAL_URL", "").rstrip("/"),
        external_key=os.getenv("IZAKHONO_SHORTS_EXTERNAL_KEY", ""),
        allow_external=os.getenv("IZAKHONO_SHORTS_ALLOW_EXTERNAL_FALLBACK", "false").lower() == "true",
    )


def post_json(url: str, payload: dict[str, Any], headers: dict[str, str] | None = None, timeout: int = 300) -> dict[str, Any]:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"content-type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read().decode("utf-8")
        return json.loads(raw)


def invoke_renderer(job: dict[str, Any]) -> tuple[str, dict[str, Any]]:
    cfg = adapter_config()
    payload = {
        "schema": "izakhono.shorts.render.v1",
        "job_id": job["id"],
        "plan": job["plan"],
        "output": {"container": "mp4", "width": 1080, "height": 1920, "fps": 30},
        "policy": {
            "owned_first": True,
            "external_fallback_reversible": True,
            "no_tracking": True,
            "originality_required": True,
        },
    }

    def call(base: str, key: str) -> dict[str, Any]:
        if not base:
            raise RuntimeError("renderer_url_missing")
        headers = {"x-izakhono-shorts-key": key} if key else {}
        return post_json(base + "/api/v1/render", payload, headers=headers)

    owned_error = None
    try:
        result = call(cfg.owned_url, cfg.owned_key)
        if not isinstance(result, dict) or not result.get("ok"):
            raise RuntimeError("invalid_owned_renderer_response")
        return "owned", result
    except Exception as exc:  # network boundary
        owned_error = str(exc)[:220]

    if not (cfg.allow_external and cfg.external_url):
        raise RuntimeError("owned_renderer_unavailable:" + owned_error)

    result = call(cfg.external_url, cfg.external_key)
    if not isinstance(result, dict) or not result.get("ok"):
        raise RuntimeError("invalid_external_renderer_response")
    result["owned_error"] = owned_error
    return "external-fallback", result


def new_job(payload: dict[str, Any]) -> dict[str, Any]:
    plan = build_plan(payload)
    created = now_ts()
    seed = f"{created}:{plan['title']}:{plan['prompt']}"
    jid = "shorts_" + stable_id(seed)
    return {
        "schema": SCHEMA,
        "id": jid,
        "created_at": created,
        "updated_at": created,
        "status": "queued",
        "plan": plan,
        "render": None,
        "route": None,
        "attempts": 0,
        "error": None,
    }


def save_job(job_dir: Path, job: dict[str, Any]) -> Path:
    job_dir.mkdir(parents=True, exist_ok=True)
    path = job_dir / f"{job['id']}.json"
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(job, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return path


def load_job(job_dir: Path, job_id: str) -> dict[str, Any] | None:
    if not re.fullmatch(r"shorts_[a-f0-9]{16}", job_id):
        return None
    path = job_dir / f"{job_id}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_jobs(job_dir: Path, limit: int = 25) -> list[dict[str, Any]]:
    if not job_dir.exists():
        return []
    rows = []
    for path in sorted(job_dir.glob("shorts_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]:
        try:
            job = json.loads(path.read_text(encoding="utf-8"))
            rows.append({
                "id": job.get("id"),
                "status": job.get("status"),
                "title": (job.get("plan") or {}).get("title"),
                "created_at": job.get("created_at"),
                "route": job.get("route"),
                "error": job.get("error"),
            })
        except Exception:
            continue
    return rows
