#!/usr/bin/env python3
import base64
import hmac
import json
import mimetypes
import os
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = os.getenv("IZAKHONO_MEDIA_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_MEDIA_PORT", "9696"))
INTERNAL_KEY = os.getenv("IZAKHONO_MEDIA_INTERNAL_KEY", "")
COMFY_URL = os.getenv("IZAKHONO_COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
CHECKPOINT = os.getenv("IZAKHONO_MEDIA_CHECKPOINT", "").strip()
MAX_BODY = int(os.getenv("IZAKHONO_MEDIA_MAX_BODY", "12582912"))
POLL_SECONDS = float(os.getenv("IZAKHONO_MEDIA_POLL_SECONDS", "1.0"))
JOB_TIMEOUT = int(os.getenv("IZAKHONO_MEDIA_JOB_TIMEOUT", "420"))
OUTPUT_LIMIT = int(os.getenv("IZAKHONO_MEDIA_OUTPUT_LIMIT", "8"))
GEN_LOCK = threading.Lock()

MODE_SPECS = {
    "showcase": [
        ("Product showcase", "premium studio product showcase, polished commercial photography, elegant controlled lighting, preserve the exact product shape, colours, markings and logo, uncluttered background, no added text", 0.24),
    ],
    "lifestyleshot": [
        ("Lifestyle", "realistic premium lifestyle advertising scene, naturally integrated product, cinematic but believable light, preserve the exact product shape, colours, markings and logo, no added text", 0.34),
    ],
    "metaads": [
        ("Social ad", "high-converting social-media advertising creative, premium commercial composition, strong visual hierarchy, leave clean negative space for copy, preserve the exact product shape, colours, markings and logo, do not render words or fake logos", 0.30),
    ],
    "modelshot": [
        ("Model shot", "premium fashion campaign photograph with the uploaded garment worn by a realistic adult model, preserve garment colours, cut, pattern and visible branding as closely as possible, editorial lighting, natural anatomy, no added text", 0.44),
    ],
    "catalogue": [
        ("Catalogue", "clean luxury ecommerce catalogue photograph, straight-on composition, neutral premium backdrop, accurate product proportions and colours, preserve visible markings and logo, no added text", 0.22),
    ],
    "3dbillboard": [
        ("3D billboard concept", "dramatic anamorphic outdoor billboard advertising concept featuring the uploaded product, premium city environment, depth illusion, preserve product identity and branding, no added text or fake logos", 0.40),
    ],
    "360view": [
        ("Angle 1", "commercial product photograph viewed from front-left three-quarter angle, preserve product identity, colours, proportions and branding, clean studio background, no added text", 0.36),
        ("Angle 2", "commercial product photograph viewed from left-side angle, preserve product identity, colours, proportions and branding, clean studio background, no added text", 0.40),
        ("Angle 3", "commercial product photograph viewed from rear three-quarter angle, preserve product identity, colours, proportions and branding, clean studio background, no added text", 0.44),
        ("Angle 4", "commercial product photograph viewed from right-side angle, preserve product identity, colours, proportions and branding, clean studio background, no added text", 0.40),
    ],
    "starter_campaign": [
        ("Showcase", "premium studio product showcase, polished commercial photography, elegant controlled lighting, preserve the exact product shape, colours, markings and logo, uncluttered background, no added text", 0.24),
        ("Lifestyle", "realistic premium lifestyle advertising scene, naturally integrated product, cinematic but believable light, preserve the exact product shape, colours, markings and logo, no added text", 0.34),
        ("Social ad", "high-converting social-media advertising creative, premium commercial composition, leave clean negative space for copy, preserve product identity and branding, do not render words", 0.30),
    ],
    "campaign": [
        ("Showcase", "premium studio product showcase, polished commercial photography, elegant controlled lighting, preserve the exact product shape, colours, markings and logo, uncluttered background, no added text", 0.24),
        ("Lifestyle", "realistic premium lifestyle advertising scene, naturally integrated product, cinematic but believable light, preserve product identity and branding, no added text", 0.34),
        ("Model / contextual", "premium campaign scene showing the product in realistic human use; for apparel, use a realistic adult model, preserve product colours, cut, pattern and visible branding as closely as possible, no added text", 0.44),
        ("Social ad", "high-converting social-media advertising creative, premium commercial composition, leave clean negative space for copy, preserve product identity and branding, do not render words", 0.30),
        ("Catalogue", "clean luxury ecommerce catalogue photograph, straight-on composition, neutral premium backdrop, accurate product proportions and colours, preserve visible markings and logo, no added text", 0.22),
        ("Billboard", "dramatic anamorphic outdoor billboard advertising concept featuring the uploaded product, premium city environment, depth illusion, preserve product identity and branding, no added text", 0.40),
    ],
}

NEGATIVE = (
    "wrong product, duplicate product, deformed object, distorted logo, misspelled text, fake words, watermark, "
    "low quality, blurry, overprocessed, malformed hands, extra fingers, broken anatomy, duplicate person"
)


def send_json(handler, status, obj):
    body = json.dumps(obj, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)


def http_json(url, payload=None, headers=None, timeout=20):
    data = None if payload is None else json.dumps(payload).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={"accept": "application/json", **(headers or {}), **({"content-type": "application/json"} if data is not None else {})},
        method="POST" if data is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode())


def multipart_upload(url, field, filename, content, mime="application/octet-stream"):
    boundary = "----IZAKHONO" + secrets.token_hex(16)
    chunks = []
    def add(text):
        chunks.append(text.encode())
    add(f"--{boundary}\r\n")
    add(f'Content-Disposition: form-data; name="{field}"; filename="{filename}"\r\n')
    add(f"Content-Type: {mime}\r\n\r\n")
    chunks.append(content)
    add("\r\n")
    add(f"--{boundary}\r\n")
    add('Content-Disposition: form-data; name="overwrite"\r\n\r\n')
    add("true\r\n")
    add(f"--{boundary}--\r\n")
    body = b"".join(chunks)
    req = urllib.request.Request(
        url,
        data=body,
        headers={"content-type": f"multipart/form-data; boundary={boundary}", "accept": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.loads(res.read().decode())


def parse_data_url(value):
    if not isinstance(value, str) or not value.startswith("data:image/") or "," not in value:
        raise ValueError("source_image_required")
    head, encoded = value.split(",", 1)
    mime = head[5:].split(";", 1)[0]
    if mime not in ("image/jpeg", "image/png", "image/webp"):
        raise ValueError("unsupported_image_type")
    raw = base64.b64decode(encoded, validate=True)
    if not raw or len(raw) > 10_000_000:
        raise ValueError("invalid_source_image_size")
    ext = mimetypes.guess_extension(mime) or ".jpg"
    return raw, mime, ext


def checkpoint_names():
    try:
        info = http_json(COMFY_URL + "/object_info/CheckpointLoaderSimple", timeout=4)
        values = (((info or {}).get("CheckpointLoaderSimple") or {}).get("input") or {}).get("required") or {}
        raw = values.get("ckpt_name") or []
        if raw and isinstance(raw[0], list):
            return [str(x) for x in raw[0]]
    except Exception:
        return []
    return []


def comfy_health():
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


def build_prompt(image_name, prompt_text, denoise, prefix):
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CHECKPOINT}},
        "2": {"class_type": "LoadImage", "inputs": {"image": image_name}},
        "3": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt_text, "clip": ["1", 1]}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": NEGATIVE, "clip": ["1", 1]}},
        "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["2", 0], "vae": ["1", 2]}},
        "6": {
            "class_type": "KSampler",
            "inputs": {
                "seed": secrets.randbelow(2**53 - 1),
                "steps": 28,
                "cfg": 6.5,
                "sampler_name": "dpmpp_2m",
                "scheduler": "karras",
                "denoise": float(denoise),
                "model": ["1", 0],
                "positive": ["3", 0],
                "negative": ["4", 0],
                "latent_image": ["5", 0],
            },
        },
        "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
        "8": {"class_type": "SaveImage", "inputs": {"filename_prefix": prefix, "images": ["7", 0]}},
    }


def queue_and_wait(workflow):
    client_id = uuid.uuid4().hex
    result = http_json(COMFY_URL + "/prompt", {"prompt": workflow, "client_id": client_id}, timeout=20)
    prompt_id = str(result.get("prompt_id") or "")
    if not prompt_id:
        raise RuntimeError("comfyui_prompt_rejected")
    deadline = time.time() + JOB_TIMEOUT
    while time.time() < deadline:
        history = http_json(COMFY_URL + "/history/" + urllib.parse.quote(prompt_id), timeout=10)
        record = history.get(prompt_id) if isinstance(history, dict) else None
        if record:
            status = record.get("status") or {}
            if status.get("status_str") == "error":
                raise RuntimeError("comfyui_generation_failed")
            outputs = record.get("outputs") or {}
            images = []
            for node in outputs.values():
                for item in node.get("images") or []:
                    images.append(item)
            if images:
                return images
        time.sleep(POLL_SECONDS)
    raise TimeoutError("comfyui_generation_timeout")


def fetch_comfy_image(item):
    query = urllib.parse.urlencode({
        "filename": item.get("filename", ""),
        "subfolder": item.get("subfolder", ""),
        "type": item.get("type", "output"),
    })
    with urllib.request.urlopen(COMFY_URL + "/view?" + query, timeout=30) as res:
        raw = res.read()
        mime = res.headers.get_content_type() or "image/png"
    return "data:" + mime + ";base64," + base64.b64encode(raw).decode(), mime


def render(payload):
    mode = str(payload.get("mode") or "").strip().lower()
    specs = MODE_SPECS.get(mode)
    if not specs:
        raise ValueError("unsupported_mode")
    specs = specs[:OUTPUT_LIMIT]
    source, mime, ext = parse_data_url(payload.get("source_image"))
    health = comfy_health()
    if not health["reachable"]:
        raise RuntimeError("comfyui_unavailable")
    if not CHECKPOINT:
        raise RuntimeError("media_checkpoint_not_configured")
    if not health["checkpoint_present"]:
        raise RuntimeError("media_checkpoint_not_found")

    product = str(payload.get("product") or "product").strip()[:180]
    category = str(payload.get("category") or "retail").strip()[:60]
    brief = str(payload.get("brief") or "").strip()[:1200]
    direction = str(payload.get("direction") or "").strip()[:1200]
    filename = "izakhono-source-" + uuid.uuid4().hex + ext
    uploaded = multipart_upload(COMFY_URL + "/upload/image", "image", filename, source, mime)
    image_name = str(uploaded.get("name") or filename)

    outputs = []
    for idx, (label, task, denoise) in enumerate(specs, 1):
        prompt_text = (
            f"{task}. Product: {product}. Category: {category}. "
            + (f"Campaign brief: {brief}. " if brief else "")
            + (f"Creative direction: {direction}. " if direction else "")
            + "Commercially polished, photorealistic, high detail."
        )
        prefix = f"izakhono_create/{mode}_{int(time.time())}_{idx}"
        workflow = build_prompt(image_name, prompt_text, denoise, prefix)
        images = queue_and_wait(workflow)
        if not images:
            raise RuntimeError("empty_render")
        data_url, out_mime = fetch_comfy_image(images[0])
        outputs.append({
            "label": label,
            "mode": mode,
            "mime": out_mime,
            "data_url": data_url,
            "generative": True,
        })
    return outputs


class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-MEDIA/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def authorized(self):
        supplied = self.headers.get("x-izakhono-media-key", "")
        return bool(INTERNAL_KEY and supplied and hmac.compare_digest(supplied, INTERNAL_KEY))

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        if path == "/healthz":
            health = comfy_health()
            ready = bool(INTERNAL_KEY and health["reachable"] and health["checkpoint_present"])
            return send_json(self, 200 if ready else 503, {
                "ok": ready,
                "service": "izakhono-media-runtime",
                "backend": "comfyui-local",
                "owned_runtime": True,
                "checkpoint": CHECKPOINT or None,
                "backend_health": health,
            })
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        if path != "/api/v1/generate":
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
            payload = json.loads(self.rfile.read(n).decode())
        except Exception:
            return send_json(self, 400, {"ok": False, "error": "invalid_json"})

        if not GEN_LOCK.acquire(blocking=False):
            return send_json(self, 429, {"ok": False, "error": "renderer_busy", "retry_after_seconds": 5})
        try:
            outputs = render(payload)
            return send_json(self, 200, {
                "ok": True,
                "runtime": "IZAKHONO NODE01 / local ComfyUI",
                "backend": "comfyui-local",
                "outputs": outputs,
                "notice": "AI-generated angle/model/background variations are approximations; verify product details before publication.",
            })
        except ValueError as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)})
        except TimeoutError as exc:
            return send_json(self, 504, {"ok": False, "error": str(exc)})
        except urllib.error.HTTPError as exc:
            return send_json(self, 502, {"ok": False, "error": "comfyui_http_error", "status": exc.code})
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": str(exc)[:180]})
        finally:
            GEN_LOCK.release()


if __name__ == "__main__":
    if not INTERNAL_KEY:
        raise SystemExit("IZAKHONO_MEDIA_INTERNAL_KEY is required")
    print(f"IZAKHONO Media Runtime listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
