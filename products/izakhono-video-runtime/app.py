#!/usr/bin/env python3
from __future__ import annotations

import base64
import hmac
import importlib.util
import json
import math
import mimetypes
import os
import re
import shutil
import tempfile
import threading
import time
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")

HOST = os.getenv("IZAKHONO_VIDEO_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_VIDEO_PORT", "9741"))
INTERNAL_KEY = os.getenv("IZAKHONO_VIDEO_INTERNAL_KEY", "")
MODEL_DIR = Path(os.getenv("IZAKHONO_VIDEO_MODEL_DIR", "/var/lib/izakhono/models/wan2.1-i2v-480p-diffusers")).resolve()
OUTPUT_DIR = Path(os.getenv("IZAKHONO_VIDEO_OUTPUT_DIR", "/var/lib/izakhono/video")).resolve()
ASSET_BASE_URL = os.getenv("IZAKHONO_VIDEO_ASSET_BASE_URL", f"http://127.0.0.1:{PORT}").rstrip("/")
MAX_BODY = int(os.getenv("IZAKHONO_VIDEO_MAX_BODY", "16000000"))
MAX_AREA = int(os.getenv("IZAKHONO_VIDEO_MAX_AREA", str(480 * 832)))
FPS = int(os.getenv("IZAKHONO_VIDEO_FPS", "16"))
NUM_FRAMES = int(os.getenv("IZAKHONO_VIDEO_NUM_FRAMES", "81"))
GUIDANCE = float(os.getenv("IZAKHONO_VIDEO_GUIDANCE", "5.0"))
GEN_LOCK = threading.Lock()
PIPELINE = None
SAFE_ASSET = re.compile(r"^[a-f0-9]{32}\.mp4$")

NEGATIVE = (
    "copyrighted character, logo, watermark, subtitles, text, letters, horror, gore, graphic violence, "
    "frightening face, jump scare, low quality, blurry, static still, bad anatomy, extra fingers, "
    "duplicate person, deformed face, distorted eyes"
)

def send_json(h, status: int, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    h.send_response(status)
    h.send_header("content-type", "application/json; charset=utf-8")
    h.send_header("content-length", str(len(body)))
    h.send_header("cache-control", "no-store")
    h.send_header("x-content-type-options", "nosniff")
    h.send_header("referrer-policy", "no-referrer")
    h.end_headers()
    h.wfile.write(body)

def safe_equal(a: str, b: str) -> bool:
    return hmac.compare_digest(str(a), str(b))

def dependency_status() -> dict[str, bool]:
    return {
        "torch": importlib.util.find_spec("torch") is not None,
        "diffusers": importlib.util.find_spec("diffusers") is not None,
        "transformers": importlib.util.find_spec("transformers") is not None,
        "PIL": importlib.util.find_spec("PIL") is not None,
    }

def gpu_status() -> dict[str, Any]:
    if not dependency_status()["torch"]:
        return {"available": False}
    try:
        import torch
        if not torch.cuda.is_available():
            return {"available": False}
        p = torch.cuda.get_device_properties(0)
        return {
            "available": True,
            "name": str(p.name),
            "memory_mb": int(p.total_memory / 1024 / 1024),
            "cuda": str(torch.version.cuda or ""),
        }
    except Exception as exc:
        return {"available": False, "error": str(exc)[:160]}

def model_ready() -> bool:
    return MODEL_DIR.is_dir() and (MODEL_DIR / "model_index.json").is_file()

def decode_image(value: str):
    if not isinstance(value, str) or not value.startswith("data:image/") or "," not in value:
        raise ValueError("source_image_required")
    head, encoded = value.split(",", 1)
    mime = head[5:].split(";", 1)[0]
    if mime not in {"image/png", "image/jpeg", "image/webp"}:
        raise ValueError("unsupported_image_type")
    raw = base64.b64decode(encoded, validate=True)
    if not raw or len(raw) > 12_000_000:
        raise ValueError("invalid_source_image_size")
    from PIL import Image
    import io
    return Image.open(io.BytesIO(raw)).convert("RGB")

def fit_dimensions(width: int, height: int, max_area: int, mod_value: int) -> tuple[int, int]:
    if width <= 0 or height <= 0 or max_area <= 0 or mod_value <= 0:
        raise ValueError("invalid_dimensions")
    aspect = height / width
    out_h = max(mod_value, round(math.sqrt(max_area * aspect)) // mod_value * mod_value)
    out_w = max(mod_value, round(math.sqrt(max_area / aspect)) // mod_value * mod_value)
    return int(out_w), int(out_h)

def validate_payload(payload: dict[str, Any]) -> tuple[str, int, Any]:
    if payload.get("schema") != "izakhono.video.scene.v1":
        raise ValueError("invalid_schema")
    policy = payload.get("policy") or {}
    if not policy.get("owned_first") or not policy.get("no_tracking") or not policy.get("originality_required"):
        raise ValueError("owned_privacy_originality_policy_required")
    prompt = re.sub(r"\s+", " ", str(payload.get("prompt") or "")).strip()
    if not prompt or len(prompt) > 4000:
        raise ValueError("invalid_prompt")
    duration = int(payload.get("duration_seconds") or 5)
    if duration < 1 or duration > 30:
        raise ValueError("invalid_duration")
    if str(payload.get("aspect_ratio") or "9:16") != "9:16":
        raise ValueError("vertical_9_16_required")
    image = decode_image(str(payload.get("source_image") or ""))
    return prompt, duration, image

def get_pipeline():
    global PIPELINE
    if PIPELINE is not None:
        return PIPELINE
    if not model_ready():
        raise RuntimeError("wan_model_not_staged")
    import torch
    from diffusers import AutoencoderKLWan, WanImageToVideoPipeline
    from transformers import CLIPVisionModel
    if not torch.cuda.is_available():
        raise RuntimeError("cuda_gpu_required")
    vae = AutoencoderKLWan.from_pretrained(
        str(MODEL_DIR), subfolder="vae", torch_dtype=torch.float32, local_files_only=True
    )
    image_encoder = CLIPVisionModel.from_pretrained(
        str(MODEL_DIR), subfolder="image_encoder", torch_dtype=torch.float32, local_files_only=True
    )
    pipe = WanImageToVideoPipeline.from_pretrained(
        str(MODEL_DIR),
        vae=vae,
        image_encoder=image_encoder,
        torch_dtype=torch.bfloat16,
        local_files_only=True,
    )
    pipe.to("cuda")
    PIPELINE = pipe
    return pipe

def generate(prompt: str, duration: int, image) -> tuple[Path, dict[str, Any]]:
    from diffusers.utils import export_to_video
    pipe = get_pipeline()
    mod = int(pipe.vae_scale_factor_spatial * pipe.transformer.config.patch_size[1])
    width, height = fit_dimensions(image.width, image.height, MAX_AREA, mod)
    image = image.resize((width, height))
    frames = int(NUM_FRAMES)
    if frames < 5:
        frames = 5
    frames = ((frames - 1) // 4) * 4 + 1
    result = pipe(
        image=image,
        prompt=prompt,
        negative_prompt=NEGATIVE,
        height=height,
        width=width,
        num_frames=frames,
        guidance_scale=GUIDANCE,
    ).frames[0]
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUTPUT_DIR / (uuid.uuid4().hex + ".mp4")
    export_to_video(result, str(target), fps=FPS)
    if not target.exists() or target.stat().st_size < 4096:
        raise RuntimeError("generated_video_invalid")
    return target, {
        "width": width,
        "height": height,
        "fps": FPS,
        "frames": frames,
        "generated_duration_seconds": round(frames / FPS, 3),
        "requested_duration_seconds": duration,
    }

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoVideo/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def authorized(self) -> bool:
        supplied = self.headers.get("x-izakhono-video-key", "")
        return bool(INTERNAL_KEY and supplied and safe_equal(supplied, INTERNAL_KEY))

    def serve_asset(self, name: str, head_only: bool = False) -> bool:
        if not SAFE_ASSET.fullmatch(name):
            return False
        target = (OUTPUT_DIR / name).resolve()
        if OUTPUT_DIR not in target.parents or not target.is_file():
            return False
        size = target.stat().st_size
        self.send_response(200)
        self.send_header("content-type", "video/mp4")
        self.send_header("content-length", str(size))
        self.send_header("cache-control", "private, max-age=3600")
        self.send_header("x-content-type-options", "nosniff")
        self.end_headers()
        if not head_only:
            with target.open("rb") as fh:
                shutil.copyfileobj(fh, self.wfile, length=1024 * 1024)
        return True

    def do_HEAD(self):
        path = self.path.split("?", 1)[0]
        if path.startswith("/assets/") and self.serve_asset(path.rsplit("/", 1)[-1], True):
            return
        self.send_response(404); self.send_header("content-length", "0"); self.end_headers()

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/healthz":
            deps = dependency_status()
            gpu = gpu_status()
            ready = bool(INTERNAL_KEY and all(deps.values()) and gpu.get("available") and model_ready())
            return send_json(self, 200 if ready else 503, {
                "ok": ready,
                "service": "izakhono-video-runtime",
                "version": "0.1",
                "backend": "wan-i2v-local",
                "owned_runtime": True,
                "tracking": False,
                "model_dir": str(MODEL_DIR),
                "model_staged": model_ready(),
                "dependencies": deps,
                "gpu": gpu,
                "fps": FPS,
                "num_frames": NUM_FRAMES,
                "max_area": MAX_AREA,
            })
        if path.startswith("/assets/") and self.serve_asset(path.rsplit("/", 1)[-1]):
            return
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        if self.path.split("?", 1)[0] != "/api/v1/generate":
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        if not self.authorized():
            return send_json(self, 401, {"ok": False, "error": "unauthorized"})
        try:
            n = int(self.headers.get("content-length", "0") or "0")
            if n <= 0 or n > MAX_BODY:
                raise ValueError("invalid_body_size")
            payload = json.loads(self.rfile.read(n).decode("utf-8"))
            prompt, duration, image = validate_payload(payload)
        except (ValueError, json.JSONDecodeError) as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)})
        if not GEN_LOCK.acquire(blocking=False):
            return send_json(self, 429, {"ok": False, "error": "video_busy", "retry_after_seconds": 10})
        try:
            target, meta = generate(prompt, duration, image)
            return send_json(self, 200, {
                "ok": True,
                "runtime": "IZAKHONO Video Runtime",
                "backend": "wan-i2v-local",
                "video": {
                    "mime": "video/mp4",
                    "url": ASSET_BASE_URL + "/assets/" + target.name,
                    **meta,
                },
                "policy": {
                    "owned_first": True,
                    "no_tracking": True,
                    "originality_required": True,
                },
            })
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": str(exc)[:300]})
        finally:
            GEN_LOCK.release()

if __name__ == "__main__":
    if not INTERNAL_KEY:
        raise SystemExit("IZAKHONO_VIDEO_INTERNAL_KEY is required")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"IZAKHONO Video Runtime listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
