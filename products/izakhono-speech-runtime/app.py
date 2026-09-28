#!/usr/bin/env python3
from __future__ import annotations

import base64
import hmac
import importlib.util
import io
import json
import os
import re
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")

HOST = os.getenv("IZAKHONO_SPEECH_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_SPEECH_PORT", "9731"))
INTERNAL_KEY = os.getenv("IZAKHONO_SPEECH_INTERNAL_KEY", "")
HF_HOME = Path(os.getenv("HF_HOME", "/var/lib/izakhono/speech/hf")).resolve()
MODEL_REPO = os.getenv("IZAKHONO_SPEECH_MODEL_REPO", "hexgrad/Kokoro-82M").strip()
DEFAULT_VOICE = os.getenv("IZAKHONO_SPEECH_DEFAULT_VOICE", "af_heart").strip()
MAX_TEXT = int(os.getenv("IZAKHONO_SPEECH_MAX_TEXT", "5000"))
MAX_BODY = int(os.getenv("IZAKHONO_SPEECH_MAX_BODY", "1000000"))
SAMPLE_RATE = 24000
GEN_LOCK = threading.Lock()
PIPELINES: dict[str, Any] = {}

DEFAULT_VOICES = {
    "af_heart", "af_bella", "af_nova", "af_sky", "af_sarah",
    "am_adam", "am_michael", "am_liam", "bf_emma", "bf_lily",
    "bm_george", "bm_lewis", "ff_siwis", "if_sara", "im_nicola",
}
ALLOWED_VOICES = {
    x.strip() for x in os.getenv(
        "IZAKHONO_SPEECH_VOICES", ",".join(sorted(DEFAULT_VOICES))
    ).split(",") if x.strip()
}

LANG_MAP = {
    "a": "a", "en": "a", "en-us": "a", "english": "a", "american english": "a",
    "b": "b", "en-gb": "b", "british english": "b",
    "e": "e", "es": "e", "spanish": "e",
    "f": "f", "fr": "f", "fr-fr": "f", "french": "f",
    "h": "h", "hi": "h", "hindi": "h",
    "i": "i", "it": "i", "italian": "i",
    "p": "p", "pt": "p", "pt-br": "p", "portuguese": "p", "brazilian portuguese": "p",
    "j": "j", "ja": "j", "japanese": "j",
    "z": "z", "zh": "z", "mandarin": "z", "chinese": "z",
}

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

def normalize_language(value: Any) -> str:
    key = re.sub(r"\s+", " ", str(value or "English").strip().lower())
    code = LANG_MAP.get(key)
    if not code:
        raise ValueError("language_not_supported_by_natural_voice_runtime")
    return code

def model_cache_path() -> Path:
    return HF_HOME / "hub" / ("models--" + MODEL_REPO.replace("/", "--"))

def model_snapshot_present() -> bool:
    root = model_cache_path() / "snapshots"
    if not root.exists():
        return False
    return any(p.is_dir() and any(p.iterdir()) for p in root.iterdir() if p.is_dir())

def dependencies_ready() -> dict[str, bool]:
    return {
        "kokoro": importlib.util.find_spec("kokoro") is not None,
        "numpy": importlib.util.find_spec("numpy") is not None,
        "soundfile": importlib.util.find_spec("soundfile") is not None,
    }

def validate_payload(payload: dict[str, Any]) -> tuple[str, str, str, float]:
    if payload.get("schema") != "izakhono.speech.generate.v1":
        raise ValueError("invalid_schema")
    text = re.sub(r"\s+", " ", str(payload.get("text") or "")).strip()
    if not text or len(text) > MAX_TEXT:
        raise ValueError("invalid_text")
    fmt = str(payload.get("format") or "wav").lower()
    if fmt != "wav":
        raise ValueError("wav_only")
    language = normalize_language(payload.get("language"))
    voice = str(payload.get("voice") or DEFAULT_VOICE).strip()
    if voice == "default":
        voice = DEFAULT_VOICE
    if voice not in ALLOWED_VOICES:
        raise ValueError("voice_not_allowed")
    speed = float(payload.get("speed") or 1.0)
    if speed < 0.7 or speed > 1.3:
        raise ValueError("invalid_speed")
    return text, language, voice, speed

def get_pipeline(lang_code: str):
    if lang_code in PIPELINES:
        return PIPELINES[lang_code]
    if not model_snapshot_present():
        raise RuntimeError("kokoro_model_not_staged")
    from kokoro import KPipeline
    pipe = KPipeline(lang_code=lang_code, repo_id=MODEL_REPO)
    PIPELINES[lang_code] = pipe
    return pipe

def synthesize(text: str, lang_code: str, voice: str, speed: float) -> bytes:
    import numpy as np
    import soundfile as sf
    pipe = get_pipeline(lang_code)
    chunks = []
    for item in pipe(text, voice=voice, speed=speed):
        audio = getattr(item, "audio", None)
        if audio is None and isinstance(item, tuple) and len(item) >= 3:
            audio = item[2]
        if audio is not None:
            chunks.append(np.asarray(audio, dtype=np.float32))
    if not chunks:
        raise RuntimeError("empty_speech_audio")
    audio = np.concatenate(chunks)
    buf = io.BytesIO()
    sf.write(buf, audio, SAMPLE_RATE, format="WAV", subtype="PCM_16")
    raw = buf.getvalue()
    if len(raw) < 1024:
        raise RuntimeError("speech_audio_too_small")
    return raw

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoSpeech/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def authorized(self) -> bool:
        supplied = self.headers.get("x-izakhono-speech-key", "")
        return bool(INTERNAL_KEY and supplied and safe_equal(supplied, INTERNAL_KEY))

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/healthz":
            deps = dependencies_ready()
            ready = bool(INTERNAL_KEY and all(deps.values()) and model_snapshot_present())
            return send_json(self, 200 if ready else 503, {
                "ok": ready,
                "service": "izakhono-speech-runtime",
                "version": "0.1",
                "backend": "kokoro-local",
                "owned_runtime": True,
                "tracking": False,
                "voice_cloning": False,
                "model_repo": MODEL_REPO,
                "model_staged": model_snapshot_present(),
                "dependencies": deps,
                "languages": sorted(set(LANG_MAP.values())),
                "voices": sorted(ALLOWED_VOICES),
                "sample_rate": SAMPLE_RATE,
            })
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
            text, language, voice, speed = validate_payload(payload)
        except (ValueError, json.JSONDecodeError) as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)})
        if not GEN_LOCK.acquire(blocking=False):
            return send_json(self, 429, {"ok": False, "error": "speech_busy", "retry_after_seconds": 2})
        try:
            raw = synthesize(text, language, voice, speed)
            data_url = "data:audio/wav;base64," + base64.b64encode(raw).decode("ascii")
            return send_json(self, 200, {
                "ok": True,
                "runtime": "IZAKHONO Speech Runtime",
                "backend": "kokoro-local",
                "audio": {
                    "mime": "audio/wav",
                    "sample_rate": SAMPLE_RATE,
                    "data_url": data_url,
                },
                "voice": voice,
                "language_code": language,
                "policy": {
                    "owned_first": True,
                    "no_tracking": True,
                    "voice_cloning": False,
                },
            })
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": str(exc)[:240]})
        finally:
            GEN_LOCK.release()

if __name__ == "__main__":
    if not INTERNAL_KEY:
        raise SystemExit("IZAKHONO_SPEECH_INTERNAL_KEY is required")
    print(f"IZAKHONO Speech Runtime listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
