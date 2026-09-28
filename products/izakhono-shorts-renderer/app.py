#!/usr/bin/env python3
from __future__ import annotations

import base64
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = os.getenv("IZAKHONO_SHORTS_RENDERER_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_SHORTS_RENDERER_PORT", "9721"))
INTERNAL_KEY = os.getenv("IZAKHONO_SHORTS_RENDER_KEY", "")
COMFY_URL = os.getenv("IZAKHONO_COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
CHECKPOINT = os.getenv("IZAKHONO_MEDIA_CHECKPOINT", "").strip()
OUTPUT_ROOT = Path(os.getenv("IZAKHONO_SHORTS_OUTPUT_DIR", "/var/lib/izakhono/shorts")).resolve()
ASSET_BASE_URL = os.getenv("IZAKHONO_SHORTS_ASSET_BASE_URL", f"http://127.0.0.1:{PORT}").rstrip("/")
FFMPEG = os.getenv("IZAKHONO_FFMPEG_BIN", "ffmpeg")
FFPROBE = os.getenv("IZAKHONO_FFPROBE_BIN", "ffprobe")
ESPEAK = os.getenv("IZAKHONO_ESPEAK_BIN", "espeak-ng")
POLL_SECONDS = float(os.getenv("IZAKHONO_SHORTS_COMFY_POLL_SECONDS", "1.0"))
IMAGE_TIMEOUT = int(os.getenv("IZAKHONO_SHORTS_IMAGE_TIMEOUT", "420"))
MAX_BODY = int(os.getenv("IZAKHONO_SHORTS_RENDERER_MAX_BODY", "2000000"))
MAX_SCENES = int(os.getenv("IZAKHONO_SHORTS_MAX_SCENES", "20"))
WIDTH = int(os.getenv("IZAKHONO_SHORTS_IMAGE_WIDTH", "576"))
HEIGHT = int(os.getenv("IZAKHONO_SHORTS_IMAGE_HEIGHT", "1024"))
STEPS = int(os.getenv("IZAKHONO_SHORTS_IMAGE_STEPS", "24"))
CFG = float(os.getenv("IZAKHONO_SHORTS_IMAGE_CFG", "6.0"))
BURN_CAPTIONS = os.getenv("IZAKHONO_SHORTS_BURN_CAPTIONS", "true").lower() == "true"
SPEECH_URL = os.getenv("IZAKHONO_SHORTS_SPEECH_URL", "").rstrip("/")
SPEECH_KEY = os.getenv("IZAKHONO_SHORTS_SPEECH_KEY", "")
VIDEO_URL = os.getenv("IZAKHONO_SHORTS_VIDEO_URL", "").rstrip("/")
VIDEO_KEY = os.getenv("IZAKHONO_SHORTS_VIDEO_KEY", "")
ALLOW_ESPEAK = os.getenv("IZAKHONO_SHORTS_ALLOW_ESPEAK", "true").lower() == "true"
RENDER_LOCK = threading.Lock()

NEGATIVE = (
    "copyrighted character, logo, watermark, text, letters, words, signature, horror, gore, "
    "graphic violence, frightening face, jump scare, low quality, blurry, bad anatomy, extra fingers, "
    "duplicate person, deformed face, distorted eyes"
)
SAFE_JOB = re.compile(r"^shorts_[a-f0-9]{16}$")
SAFE_ASSET = re.compile(r"^[A-Za-z0-9._-]+$")


def send_json(handler, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.send_header("referrer-policy", "no-referrer")
    handler.end_headers()
    handler.wfile.write(body)


def http_json(url: str, payload: dict[str, Any] | None = None, headers: dict[str, str] | None = None, timeout: int = 30) -> dict[str, Any]:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={"accept": "application/json", **(headers or {}), **({"content-type": "application/json"} if data is not None else {})},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def http_bytes(url: str, timeout: int = 30) -> tuple[bytes, str]:
    with urllib.request.urlopen(url, timeout=timeout) as res:
        return res.read(), res.headers.get_content_type() or "application/octet-stream"


def tool_ready(name: str) -> bool:
    return bool(shutil.which(name))


def checkpoint_names() -> list[str]:
    try:
        info = http_json(COMFY_URL + "/object_info/CheckpointLoaderSimple", timeout=4)
        values = (((info or {}).get("CheckpointLoaderSimple") or {}).get("input") or {}).get("required") or {}
        raw = values.get("ckpt_name") or []
        if raw and isinstance(raw[0], list):
            return [str(x) for x in raw[0]]
    except Exception:
        return []
    return []


def comfy_health() -> dict[str, Any]:
    try:
        stats = http_json(COMFY_URL + "/system_stats", timeout=4)
        names = checkpoint_names()
        return {
            "reachable": True,
            "checkpoint_configured": bool(CHECKPOINT),
            "checkpoint_present": bool(CHECKPOINT and CHECKPOINT in names),
            "available_checkpoints": names[:20],
            "system": stats.get("system") if isinstance(stats, dict) else None,
        }
    except Exception as exc:
        return {
            "reachable": False,
            "checkpoint_configured": bool(CHECKPOINT),
            "checkpoint_present": False,
            "available_checkpoints": [],
            "error": str(exc)[:160],
        }


def build_text2image_workflow(prompt_text: str, prefix: str, width: int = WIDTH, height: int = HEIGHT) -> dict[str, Any]:
    if not CHECKPOINT:
        raise RuntimeError("media_checkpoint_not_configured")
    width = max(256, min(int(width), 1536))
    height = max(256, min(int(height), 2048))
    width -= width % 8
    height -= height % 8
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt_text, "clip": ["1", 1]}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
        "4": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "5": {
            "class_type": "KSampler",
            "inputs": {
                "seed": secrets.randbelow(2**53 - 1),
                "steps": STEPS,
                "cfg": CFG,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": 1.0,
                "model": ["1", 0],
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["4", 0],
            },
        },
        "6": {"class_type": "VAEDecode", "inputs": {"samples": ["5", 0], "vae": ["1", 2]}},
        "7": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["6", 0]}},
    }


def queue_comfy(workflow: dict[str, Any]) -> list[dict[str, Any]]:
    client_id = uuid.uuid4().hex
    result = http_json(COMFY_URL + "/prompt", {"prompt": workflow, "client_id": client_id}, timeout=20)
    prompt_id = str(result.get("prompt_id") or "")
    if not prompt_id:
        raise RuntimeError("comfyui_prompt_rejected")
    deadline = time.time() + IMAGE_TIMEOUT
    while time.time() < deadline:
        history = http_json(COMFY_URL + "/history/" + urllib.parse.quote(prompt_id), timeout=10)
        record = history.get(prompt_id) if isinstance(history, dict) else None
        if record:
            status = record.get("status") or {}
            if status.get("status_str") == "error":
                raise RuntimeError("comfyui_generation_failed")
            images: list[dict[str, Any]] = []
            for node in (record.get("outputs") or {}).values():
                images.extend(node.get("images") or [])
            if images:
                return images
        time.sleep(POLL_SECONDS)
    raise TimeoutError("comfyui_generation_timeout")


def fetch_comfy_image(item: dict[str, Any], target: Path) -> None:
    query = urllib.parse.urlencode({
        "filename": item.get("filename", ""),
        "subfolder": item.get("subfolder", ""),
        "type": item.get("type", "output"),
    })
    raw, mime = http_bytes(COMFY_URL + "/view?" + query, timeout=30)
    if mime not in ("image/png", "image/jpeg", "image/webp"):
        raise RuntimeError("invalid_comfy_image_type")
    target.write_bytes(raw)


def run(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=timeout, check=False)


def clean_caption(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip()


def vtt_time(seconds: float) -> str:
    ms = max(0, round(seconds * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"


def write_captions(scenes: list[dict[str, Any]], path: Path) -> None:
    lines = ["WEBVTT", ""]
    cursor = 0.0
    for idx, scene in enumerate(scenes, 1):
        duration = float(scene.get("duration_seconds") or 7)
        text = clean_caption(scene.get("narration") or scene.get("beat") or f"Scene {idx}")
        lines += [str(idx), f"{vtt_time(cursor)} --> {vtt_time(cursor + duration)}", text, ""]
        cursor += duration
    path.write_text("\n".join(lines), encoding="utf-8")


def decode_data_url(value: str) -> tuple[bytes, str]:
    if not value.startswith("data:") or "," not in value:
        raise ValueError("invalid_data_url")
    head, encoded = value.split(",", 1)
    mime = head[5:].split(";", 1)[0]
    return base64.b64decode(encoded), mime


def request_owned_speech(text: str, language: str, target: Path) -> bool:
    if not SPEECH_URL:
        return False
    headers = {"x-izakhono-speech-key": SPEECH_KEY} if SPEECH_KEY else {}
    payload = {
        "schema": "izakhono.speech.generate.v1",
        "text": text,
        "language": language,
        "format": "wav",
        "voice": "default",
        "policy": {"owned_first": True, "no_tracking": True},
    }
    result = http_json(SPEECH_URL + "/api/v1/generate", payload, headers=headers, timeout=180)
    if not result.get("ok"):
        raise RuntimeError("owned_speech_invalid_response")
    data_url = str((result.get("audio") or {}).get("data_url") or result.get("data_url") or "")
    asset_url = str((result.get("audio") or {}).get("url") or result.get("url") or "")
    if data_url:
        raw, mime = decode_data_url(data_url)
        if not mime.startswith("audio/"):
            raise RuntimeError("owned_speech_invalid_mime")
        target.write_bytes(raw)
        return True
    if asset_url:
        raw, mime = http_bytes(asset_url, timeout=60)
        if not mime.startswith("audio/"):
            raise RuntimeError("owned_speech_invalid_mime")
        target.write_bytes(raw)
        return True
    raise RuntimeError("owned_speech_asset_missing")


def synthesize_speech(text: str, language: str, target: Path) -> str:
    if SPEECH_URL:
        try:
            if request_owned_speech(text, language, target):
                return "owned-speech-adapter"
        except Exception:
            # Explicitly local fallback; never sends the text to another external provider.
            pass
    if not ALLOW_ESPEAK or not tool_ready(ESPEAK):
        raise RuntimeError("speech_backend_unavailable")
    proc = run([ESPEAK, "-w", str(target), "-s", "150", "-p", "46", clean_caption(text)], timeout=120)
    if proc.returncode != 0 or not target.exists() or target.stat().st_size < 100:
        raise RuntimeError("espeak_generation_failed:" + proc.stderr[-160:])
    return "espeak-local"


def try_video_adapter(scene: dict[str, Any], image_path: Path, target: Path) -> bool:
    if not VIDEO_URL:
        return False
    image_data = base64.b64encode(image_path.read_bytes()).decode("ascii")
    payload = {
        "schema": "izakhono.video.scene.v1",
        "prompt": scene.get("visual_prompt"),
        "duration_seconds": int(scene.get("duration_seconds") or 7),
        "aspect_ratio": "9:16",
        "source_image": "data:image/png;base64," + image_data,
        "policy": {"owned_first": True, "no_tracking": True, "originality_required": True},
    }
    headers = {"x-izakhono-video-key": VIDEO_KEY} if VIDEO_KEY else {}
    result = http_json(VIDEO_URL + "/api/v1/generate", payload, headers=headers, timeout=600)
    if not result.get("ok"):
        return False
    data_url = str((result.get("video") or {}).get("data_url") or result.get("data_url") or "")
    asset_url = str((result.get("video") or {}).get("url") or result.get("url") or "")
    if data_url:
        raw, mime = decode_data_url(data_url)
        if mime != "video/mp4":
            return False
        target.write_bytes(raw)
        return True
    if asset_url:
        raw, mime = http_bytes(asset_url, timeout=180)
        if mime not in ("video/mp4", "application/octet-stream"):
            return False
        target.write_bytes(raw)
        return True
    return False


def create_scene_video(image_path: Path, audio_path: Path, duration: float, target: Path) -> str:
    if not tool_ready(FFMPEG):
        raise RuntimeError("ffmpeg_missing")
    frames = max(1, round(duration * 30))
    # Slow push-in and subtle horizontal drift. This gives a finished motion video without
    # requiring a third-party animation provider; an owned video adapter can replace it.
    vf = (
        f"scale=1080:1920:force_original_aspect_ratio=increase,"
        f"crop=1080:1920,"
        f"zoompan=z='min(zoom+0.0009,1.10)':x='iw/2-(iw/zoom/2)+sin(on/35)*8':"
        f"y='ih/2-(ih/zoom/2)':d={frames}:s=1080x1920:fps=30,"
        f"format=yuv420p"
    )
    cmd = [
        FFMPEG, "-y", "-loop", "1", "-i", str(image_path), "-i", str(audio_path),
        "-vf", vf, "-af", f"apad=pad_dur={duration},atrim=0:{duration}",
        "-t", f"{duration:.3f}", "-r", "30",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", "-shortest", str(target),
    ]
    proc = run(cmd, timeout=max(180, int(duration * 12)))
    if proc.returncode != 0 or not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("ffmpeg_scene_failed:" + proc.stderr[-300:])
    return "ffmpeg-motion"


def concat_scenes(scene_files: list[Path], target: Path) -> None:
    manifest = target.with_suffix(".concat.txt")
    manifest.write_text("".join(f"file '{p.as_posix()}'\n" for p in scene_files), encoding="utf-8")
    proc = run([
        FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(manifest),
        "-c", "copy", "-movflags", "+faststart", str(target),
    ], timeout=600)
    if proc.returncode != 0 or not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("ffmpeg_concat_failed:" + proc.stderr[-300:])


def burn_captions(video: Path, captions_vtt: Path, target: Path) -> bool:
    if not BURN_CAPTIONS:
        return False
    # libass/subtitles is present in normal distro FFmpeg builds. If absent, keep the
    # clean MP4 plus VTT sidecar rather than failing the entire render.
    safe = str(captions_vtt).replace("\\", "/").replace(":", r"\:")
    style = "FontName=DejaVu Sans,FontSize=18,Outline=2,Shadow=0,Alignment=2,MarginV=90"
    proc = run([
        FFMPEG, "-y", "-i", str(video),
        "-vf", f"subtitles='{safe}':force_style='{style}'",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
        "-c:a", "copy", "-movflags", "+faststart", str(target),
    ], timeout=900)
    return proc.returncode == 0 and target.exists() and target.stat().st_size > 4096


def probe_duration(path: Path) -> float | None:
    if not tool_ready(FFPROBE):
        return None
    proc = run([
        FFPROBE, "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(path)
    ], timeout=30)
    if proc.returncode != 0:
        return None
    try:
        return float(proc.stdout.strip())
    except Exception:
        return None


def validate_request(payload: dict[str, Any]) -> tuple[str, dict[str, Any], dict[str, Any]]:
    if payload.get("schema") != "izakhono.shorts.render.v1":
        raise ValueError("invalid_schema")
    job_id = str(payload.get("job_id") or "")
    if not SAFE_JOB.fullmatch(job_id):
        raise ValueError("invalid_job_id")
    plan = payload.get("plan")
    if not isinstance(plan, dict) or plan.get("schema") != "izakhono.shorts.plan.v1":
        raise ValueError("invalid_plan")
    scenes = plan.get("scenes")
    if not isinstance(scenes, list) or not scenes or len(scenes) > MAX_SCENES:
        raise ValueError("invalid_scenes")
    for scene in scenes:
        if not isinstance(scene, dict):
            raise ValueError("invalid_scene")
        dur = float(scene.get("duration_seconds") or 0)
        if dur < 1 or dur > 30:
            raise ValueError("invalid_scene_duration")
        if not str(scene.get("visual_prompt") or "").strip():
            raise ValueError("visual_prompt_required")
    policy = payload.get("policy") or {}
    if not bool(policy.get("owned_first")) or not bool(policy.get("no_tracking")):
        raise ValueError("owned_privacy_policy_required")
    output = payload.get("output") or {}
    return job_id, plan, output


def render(payload: dict[str, Any]) -> dict[str, Any]:
    job_id, plan, output = validate_request(payload)
    health = comfy_health()
    if not health["reachable"]:
        raise RuntimeError("comfyui_unavailable")
    if not CHECKPOINT:
        raise RuntimeError("media_checkpoint_not_configured")
    if not health["checkpoint_present"]:
        raise RuntimeError("media_checkpoint_not_found")
    if not tool_ready(FFMPEG):
        raise RuntimeError("ffmpeg_missing")

    job_dir = OUTPUT_ROOT / job_id
    work_dir = job_dir / "work"
    if job_dir.exists():
        shutil.rmtree(job_dir)
    work_dir.mkdir(parents=True, exist_ok=True)

    scenes = plan["scenes"]
    scene_videos: list[Path] = []
    scene_results: list[dict[str, Any]] = []
    speech_routes: set[str] = set()
    motion_routes: set[str] = set()

    for idx, scene in enumerate(scenes, 1):
        prefix = f"izakhono_shorts/{job_id}/scene_{idx:02d}"
        image_path = work_dir / f"scene-{idx:02d}.png"
        audio_path = work_dir / f"scene-{idx:02d}.wav"
        video_path = work_dir / f"scene-{idx:02d}.mp4"
        duration = float(scene.get("duration_seconds") or 7)
        prompt = (
            str(scene.get("visual_prompt") or "")[:3500]
            + " Original design only. Consistent recurring character identity across the episode. "
            + "No text, no logos, no copyrighted characters, vertical composition, child-safe when applicable."
        )
        workflow = build_text2image_workflow(prompt, prefix)
        images = queue_comfy(workflow)
        if not images:
            raise RuntimeError("empty_scene_image")
        fetch_comfy_image(images[0], image_path)

        narration = clean_caption(scene.get("narration") or scene.get("beat") or f"Scene {idx}")
        speech_route = synthesize_speech(narration, str(scene.get("language") or plan.get("language") or "English"), audio_path)
        speech_routes.add(speech_route)

        motion_route = "owned-video-adapter" if try_video_adapter(scene, image_path, video_path) else create_scene_video(image_path, audio_path, duration, video_path)
        motion_routes.add(motion_route)
        # If the optional video adapter generated silent video, mux our locally generated voice.
        if motion_route == "owned-video-adapter":
            muxed = work_dir / f"scene-{idx:02d}-voiced.mp4"
            proc = run([
                FFMPEG, "-y", "-stream_loop", "-1", "-i", str(video_path), "-i", str(audio_path),
                "-map", "0:v:0", "-map", "1:a:0",
                "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,format=yuv420p",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "21",
                "-c:a", "aac", "-b:a", "128k",
                "-af", f"apad=pad_dur={duration},atrim=0:{duration}",
                "-t", f"{duration:.3f}", "-r", "30", "-shortest", str(muxed)
            ], timeout=max(300, int(duration * 30)))
            if proc.returncode == 0 and muxed.exists():
                muxed.replace(video_path)
        scene_videos.append(video_path)
        scene_results.append({
            "index": idx,
            "image": image_path.name,
            "video": video_path.name,
            "speech_route": speech_route,
            "motion_route": motion_route,
        })

    captions = job_dir / "captions.vtt"
    write_captions(scenes, captions)
    clean_output = job_dir / "output-clean.mp4"
    concat_scenes(scene_videos, clean_output)
    final_output = job_dir / "output.mp4"
    captions_burned = burn_captions(clean_output, captions, final_output)
    if not captions_burned:
        shutil.copy2(clean_output, final_output)

    duration = probe_duration(final_output)
    manifest = {
        "schema": "izakhono.shorts.asset.v1",
        "job_id": job_id,
        "title": plan.get("title"),
        "created_at": int(time.time()),
        "route": "owned",
        "renderer": "izakhono-shorts-renderer",
        "image_backend": "comfyui-local",
        "speech_routes": sorted(speech_routes),
        "motion_routes": sorted(motion_routes),
        "captions_burned": captions_burned,
        "duration_seconds": duration,
        "scenes": scene_results,
        "output": output,
        "policy": {
            "no_tracking": True,
            "originality_required": True,
            "autopublish": False,
        },
    }
    (job_dir / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    base = f"{ASSET_BASE_URL}/assets/{job_id}"
    return {
        "ok": True,
        "route": "owned",
        "renderer": "IZAKHONO SHORTS RENDERER",
        "asset": {"type": "video/mp4", "url": base + "/output.mp4"},
        "captions": {"type": "text/vtt", "url": base + "/captions.vtt", "burned_in": captions_burned},
        "manifest": {"type": "application/json", "url": base + "/manifest.json"},
        "duration_seconds": duration,
        "scene_count": len(scene_results),
        "speech_routes": sorted(speech_routes),
        "motion_routes": sorted(motion_routes),
    }




class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-Shorts-Renderer/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def authorized(self) -> bool:
        supplied = self.headers.get("x-izakhono-shorts-key", "")
        return bool(INTERNAL_KEY and supplied and hmac.compare_digest(supplied, INTERNAL_KEY))

    def resolve_asset(self, path: str) -> tuple[Path, str] | None:
        parts = path.strip("/").split("/")
        if len(parts) != 3 or parts[0] != "assets":
            return None
        job_id, name = parts[1], parts[2]
        if not SAFE_JOB.fullmatch(job_id) or not SAFE_ASSET.fullmatch(name):
            return None
        target = (OUTPUT_ROOT / job_id / name).resolve()
        if OUTPUT_ROOT not in target.parents or not target.exists() or not target.is_file():
            return None
        return target, mimetypes.guess_type(name)[0] or "application/octet-stream"

    def serve_asset(self, path: str, head_only: bool = False) -> bool:
        resolved = self.resolve_asset(path)
        if not resolved:
            return False
        target, content_type = resolved
        size = target.stat().st_size
        self.send_response(200)
        self.send_header("content-type", content_type)
        self.send_header("content-length", str(size))
        self.send_header("cache-control", "private, max-age=3600")
        self.send_header("x-content-type-options", "nosniff")
        self.end_headers()
        if not head_only:
            with target.open("rb") as fh:
                shutil.copyfileobj(fh, self.wfile, length=1024 * 1024)
        return True

    def do_HEAD(self):
        path = urllib.parse.urlparse(self.path).path
        if path.startswith("/assets/") and self.serve_asset(path, head_only=True):
            return
        self.send_response(404)
        self.send_header("content-length", "0")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/healthz":
            health = comfy_health()
            tools = {
                "ffmpeg": tool_ready(FFMPEG),
                "ffprobe": tool_ready(FFPROBE),
                "espeak": tool_ready(ESPEAK),
            }
            ready = bool(
                INTERNAL_KEY
                and health["reachable"]
                and health["checkpoint_present"]
                and tools["ffmpeg"]
                and (SPEECH_URL or (ALLOW_ESPEAK and tools["espeak"]))
            )
            return send_json(self, 200 if ready else 503, {
                "ok": ready,
                "service": "izakhono-shorts-renderer",
                "version": "0.1",
                "owned_runtime": True,
                "tracking": False,
                "autopublish": False,
                "backend": "comfyui-local",
                "checkpoint": CHECKPOINT or None,
                "backend_health": health,
                "tools": tools,
                "owned_speech_adapter": bool(SPEECH_URL),
                "owned_video_adapter": bool(VIDEO_URL),
                "fallback_motion": "ffmpeg-pan-zoom",
                "fallback_speech": "espeak-local" if ALLOW_ESPEAK else None,
            })
        if path.startswith("/assets/") and self.serve_asset(path):
            return
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path != "/api/v1/render":
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        if not self.authorized():
            return send_json(self, 401, {"ok": False, "error": "unauthorized"})
        try:
            n = int(self.headers.get("content-length", "0") or "0")
        except Exception:
            n = 0
        if n <= 0 or n > MAX_BODY:
            return send_json(self, 413, {"ok": False, "error": "invalid_body_size"})
        try:
            payload = json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:
            return send_json(self, 400, {"ok": False, "error": "invalid_json"})
        if not RENDER_LOCK.acquire(blocking=False):
            return send_json(self, 429, {"ok": False, "error": "renderer_busy", "retry_after_seconds": 10})
        try:
            result = render(payload)
            return send_json(self, 200, result)
        except ValueError as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)[:240]})
        except TimeoutError as exc:
            return send_json(self, 504, {"ok": False, "error": str(exc)[:240]})
        except urllib.error.HTTPError as exc:
            return send_json(self, 502, {"ok": False, "error": "owned_backend_http_error", "status": exc.code})
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": str(exc)[:300]})
        finally:
            RENDER_LOCK.release()


if __name__ == "__main__":
    if not INTERNAL_KEY:
        raise SystemExit("IZAKHONO_SHORTS_RENDER_KEY is required")
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    print(f"IZAKHONO SHORTS RENDERER listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
