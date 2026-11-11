#!/usr/bin/env python3
"""Owner-hosted speech recognition API for IZAKHONO VOICE."""
from __future__ import annotations
import base64, binascii, hmac, importlib.util, json, os, tempfile, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST = os.getenv("IZAKHONO_ASR_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_ASR_PORT", "9732"))
KEY = os.getenv("IZAKHONO_ASR_INTERNAL_KEY", "")
MODEL_PATH = Path(os.getenv("IZAKHONO_ASR_MODEL_PATH", "/var/lib/izakhono/asr/model")).resolve()
MAX_BODY = 4 * 1024 * 1024
MAX_AUDIO = 2 * 1024 * 1024
MODEL = None
MODEL_LOCK = threading.Lock()
INFERENCE_LOCK = threading.Lock()

def load_model():
    global MODEL
    if MODEL is not None:
        return MODEL
    with MODEL_LOCK:
        if MODEL is not None:
            return MODEL
        if not (MODEL_PATH / "model.bin").is_file() or not (MODEL_PATH / "config.json").is_file():
            raise RuntimeError("asr_model_not_staged")
        from faster_whisper import WhisperModel
        MODEL = WhisperModel(str(MODEL_PATH), device="cpu", compute_type="int8", local_files_only=True)
        return MODEL

def send_json(handler, status, payload):
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(raw)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.end_headers()
    handler.wfile.write(raw)

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoASR/0.1"
    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")
    def authorized(self):
        supplied = self.headers.get("x-izakhono-speech-key", "")
        return bool(KEY and supplied and hmac.compare_digest(KEY, supplied))
    def do_GET(self):
        if self.path != "/healthz":
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        ready = bool(KEY and importlib.util.find_spec("faster_whisper") and (MODEL_PATH / "model.bin").is_file() and (MODEL_PATH / "config.json").is_file())
        return send_json(self, 200 if ready else 503, {
            "ok": ready, "service": "izakhono-asr-runtime", "backend": "faster-whisper-local",
            "owned_runtime": True, "model_staged": (MODEL_PATH / "model.bin").is_file(), "runtime_dependency_ready": importlib.util.find_spec("faster_whisper") is not None,
            "inference_network_required": False,
        })
    def do_POST(self):
        if self.path != "/api/v1/transcribe":
            return send_json(self, 404, {"ok": False, "error": "not_found"})
        if not self.authorized():
            return send_json(self, 401, {"ok": False, "error": "unauthorized"})
        try:
            size = int(self.headers.get("content-length", "0"))
            if size <= 0 or size > MAX_BODY:
                raise ValueError("invalid_body_size")
            payload = json.loads(self.rfile.read(size))
            if payload.get("schema") != "izakhono.speech.transcribe.v1":
                raise ValueError("invalid_schema")
            encoded = payload.get("audio_base64", "")
            if not isinstance(encoded, str) or not encoded or len(encoded) > MAX_AUDIO * 4 // 3 + 8:
                raise ValueError("invalid_audio")
            audio = base64.b64decode(encoded, validate=True)
            if len(audio) < 1024 or len(audio) > MAX_AUDIO or not audio.startswith(b"RIFF") or audio[8:12] != b"WAVE":
                raise ValueError("expected_pcm_wav")
            language = str(payload.get("language") or "en").strip().lower()
            if language not in {"en", "af", "zu", "xh", "st", "tn", "nso", "ts", "ss", "ve"}:
                raise ValueError("unsupported_language")
        except (ValueError, TypeError, json.JSONDecodeError, binascii.Error) as exc:
            return send_json(self, 422, {"ok": False, "error": str(exc)[:120]})
        try:
            model = load_model()
            with tempfile.NamedTemporaryFile(suffix=".wav") as file:
                file.write(audio); file.flush()
                with INFERENCE_LOCK:
                    segments, info = model.transcribe(file.name, language=language, beam_size=1, vad_filter=True)
                    text = " ".join(segment.text.strip() for segment in segments).strip()
            return send_json(self, 200, {
                "ok": True, "text": text, "language": info.language,
                "language_probability": round(float(info.language_probability), 4),
                "backend": "faster-whisper-local",
            })
        except Exception as exc:
            return send_json(self, 503, {"ok": False, "error": str(exc)[:160]})

if __name__ == "__main__":
    if not KEY:
        raise SystemExit("IZAKHONO_ASR_INTERNAL_KEY is required")
    print(f"IZAKHONO ASR runtime listening on {HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
