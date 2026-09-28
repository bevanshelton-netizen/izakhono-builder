#!/usr/bin/env python3
from __future__ import annotations

import base64
import ipaddress
import json
import os
import socket
import subprocess
import threading
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

FABRIC_URL = os.getenv("IZAKHONO_MEDIA_FABRIC_URL", "http://127.0.0.1:9751").rstrip("/")
FABRIC_KEY = os.getenv("IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY", "")
WORKER_ID = os.getenv("IZAKHONO_MEDIA_WORKER_ID", socket.gethostname().lower() + "-media").strip()
NODE_ID = os.getenv("IZAKHONO_MEDIA_NODE_ID", socket.gethostname().lower()).strip()
MAX_JOBS = max(1, min(8, int(os.getenv("IZAKHONO_MEDIA_WORKER_MAX_JOBS", "1"))))
POLL_SECONDS = max(1, int(os.getenv("IZAKHONO_MEDIA_WORKER_POLL_SECONDS", "3")))
LEASE_SECONDS = max(60, int(os.getenv("IZAKHONO_MEDIA_WORKER_LEASE_SECONDS", "300")))
LEASE_RENEW_SECONDS = max(15, min(LEASE_SECONDS // 2, int(os.getenv("IZAKHONO_MEDIA_WORKER_LEASE_RENEW_SECONDS", "60"))))

SPEECH_URL = os.getenv("IZAKHONO_SPEECH_URL", "http://127.0.0.1:9731").rstrip("/")
SPEECH_KEY = os.getenv("IZAKHONO_SPEECH_INTERNAL_KEY", "")
VIDEO_URL = os.getenv("IZAKHONO_VIDEO_URL", "http://127.0.0.1:9741").rstrip("/")
VIDEO_KEY = os.getenv("IZAKHONO_VIDEO_INTERNAL_KEY", "")
VERSION = "0.1"


def private_or_https(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    if parsed.scheme == "https":
        return True
    host = parsed.hostname.lower()
    if host == "localhost":
        return True
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError:
        try:
            values = socket.gethostbyname_ex(host)[2]
            return bool(values) and all(
                ipaddress.ip_address(value).is_private
                or ipaddress.ip_address(value).is_loopback
                or ipaddress.ip_address(value).is_link_local
                for value in values
            )
        except OSError:
            return False


def request_json(
    url: str,
    payload: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    timeout: int = 120,
) -> dict[str, Any]:
    body = None if payload is None else json.dumps(payload, separators=(",", ":")).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"accept": "application/json", **({"content-type": "application/json"} if body is not None else {}), **(headers or {})},
        method="POST" if body is not None else "GET",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        raw = res.read()
        return json.loads(raw.decode("utf-8")) if raw else {}


def fabric_json(path: str, payload: dict[str, Any] | None = None, timeout: int = 120) -> dict[str, Any]:
    return request_json(
        FABRIC_URL + path,
        payload,
        {"x-izakhono-media-fabric-key": FABRIC_KEY},
        timeout=timeout,
    )


def local_health(base: str) -> bool:
    if not base or not private_or_https(base):
        return False
    try:
        value = request_json(base + "/healthz", timeout=3)
        return value.get("ok") is True
    except Exception:
        return False


def gpu_status() -> dict[str, Any]:
    cmd = [
        "nvidia-smi",
        "--query-gpu=name,memory.total,memory.free,utilization.gpu",
        "--format=csv,noheader,nounits",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=8, check=False)
        if proc.returncode != 0 or not proc.stdout.strip():
            return {"available": False}
        first = proc.stdout.strip().splitlines()[0]
        parts = [x.strip() for x in first.split(",")]
        return {
            "available": True,
            "name": parts[0],
            "memory_mb": int(parts[1]),
            "memory_free_mb": int(parts[2]),
            "utilization_percent": int(parts[3]),
        }
    except Exception:
        return {"available": False}


def capabilities() -> list[str]:
    result: list[str] = []
    if SPEECH_KEY and local_health(SPEECH_URL):
        result.append("speech")
    if VIDEO_KEY and local_health(VIDEO_URL):
        result.append("video")
    return result


def register() -> list[str]:
    caps = capabilities()
    if not caps:
        return []
    response = fabric_json("/api/v1/workers/register", {
        "worker_id": WORKER_ID,
        "node_id": NODE_ID,
        "capabilities": caps,
        "gpu": gpu_status(),
        "labels": {
            "owned": True,
            "runtime_class": os.getenv("IZAKHONO_MEDIA_WORKER_CLASS", "owned-runtime"),
        },
        "max_jobs": MAX_JOBS,
        "version": VERSION,
    })
    if response.get("ok") is not True:
        raise RuntimeError("worker_registration_failed")
    return caps


def heartbeat(active_jobs: int = 0) -> None:
    fabric_json(
        f"/api/v1/workers/{WORKER_ID}/heartbeat",
        {"gpu": gpu_status(), "active_jobs": active_jobs},
        timeout=15,
    )


class LeaseKeeper:
    def __init__(self, job_id: str):
        self.job_id = job_id
        self.stop_event = threading.Event()
        self.failed = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self) -> None:
        self.thread.start()

    def _run(self) -> None:
        while not self.stop_event.wait(LEASE_RENEW_SECONDS):
            try:
                value = fabric_json(
                    f"/api/v1/jobs/{self.job_id}/lease",
                    {"worker_id": WORKER_ID, "lease_seconds": LEASE_SECONDS},
                    timeout=20,
                )
                if value.get("ok") is not True:
                    self.failed.set()
                    return
            except Exception:
                self.failed.set()
                return

    def stop(self) -> None:
        self.stop_event.set()
        self.thread.join(timeout=3)


def upload_artifact(job_id: str, name: str, mime: str, data: bytes) -> dict[str, Any]:
    req = urllib.request.Request(
        f"{FABRIC_URL}/api/v1/artifacts/{job_id}/{name}",
        data=data,
        headers={
            "content-type": mime,
            "content-length": str(len(data)),
            "x-izakhono-media-fabric-key": FABRIC_KEY,
            "x-izakhono-worker-id": WORKER_ID,
        },
        method="PUT",
    )
    with urllib.request.urlopen(req, timeout=900) as res:
        raw = res.read()
        value = json.loads(raw.decode("utf-8")) if raw else {}
    if value.get("ok") is not True:
        raise RuntimeError("artifact_upload_failed")
    return value["artifact"]


def decode_data_url(value: str, expected_prefix: str) -> bytes:
    if not isinstance(value, str) or not value.startswith(expected_prefix) or "," not in value:
        raise RuntimeError("invalid_data_url")
    return base64.b64decode(value.split(",", 1)[1], validate=True)


def execute_speech(payload: dict[str, Any], job_id: str) -> dict[str, Any]:
    if not SPEECH_KEY or not local_health(SPEECH_URL):
        raise RuntimeError("speech_runtime_unavailable")
    response = request_json(
        SPEECH_URL + "/api/v1/generate",
        payload,
        {"x-izakhono-speech-key": SPEECH_KEY},
        timeout=600,
    )
    if response.get("ok") is not True:
        raise RuntimeError("speech_generation_failed:" + str(response.get("error") or "unknown")[:160])
    audio = response.get("audio") or {}
    raw = decode_data_url(str(audio.get("data_url") or ""), "data:audio/wav;base64,")
    artifact = upload_artifact(job_id, "speech.wav", "audio/wav", raw)
    return {
        "backend": response.get("backend"),
        "voice": response.get("voice"),
        "language_code": response.get("language_code"),
        "artifact": artifact,
    }


def download_binary(url: str, timeout: int = 1800) -> tuple[bytes, str]:
    if not private_or_https(url):
        raise RuntimeError("generated_asset_route_not_owner_private")
    req = urllib.request.Request(url, method="GET")
    with urllib.request.urlopen(req, timeout=timeout) as res:
        mime = str(res.headers.get("content-type") or "application/octet-stream")
        raw = res.read()
    if not raw:
        raise RuntimeError("generated_asset_empty")
    return raw, mime


def execute_video(payload: dict[str, Any], job_id: str) -> dict[str, Any]:
    if not VIDEO_KEY or not local_health(VIDEO_URL):
        raise RuntimeError("video_runtime_unavailable")
    response = request_json(
        VIDEO_URL + "/api/v1/generate",
        payload,
        {"x-izakhono-video-key": VIDEO_KEY},
        timeout=3600,
    )
    if response.get("ok") is not True:
        raise RuntimeError("video_generation_failed:" + str(response.get("error") or "unknown")[:160])
    video = response.get("video") or {}
    raw, mime = download_binary(str(video.get("url") or ""))
    artifact = upload_artifact(job_id, "video.mp4", "video/mp4" if "video/mp4" in mime else mime, raw)
    return {
        "backend": response.get("backend"),
        "video": {
            "artifact": artifact,
            "width": video.get("width"),
            "height": video.get("height"),
            "fps": video.get("fps"),
            "frames": video.get("frames"),
            "generated_duration_seconds": video.get("generated_duration_seconds"),
        },
    }


def execute_job(job: dict[str, Any]) -> dict[str, Any]:
    capability = str(job.get("capability") or "")
    payload = job.get("payload") if isinstance(job.get("payload"), dict) else {}
    if capability == "speech":
        return execute_speech(payload, job["id"])
    if capability == "video":
        return execute_video(payload, job["id"])
    raise RuntimeError("worker_capability_not_implemented")


def fail(job_id: str, error: str, retryable: bool = True) -> None:
    try:
        fabric_json(
            f"/api/v1/jobs/{job_id}/fail",
            {"worker_id": WORKER_ID, "error": str(error)[:500], "retryable": bool(retryable)},
            timeout=20,
        )
    except Exception:
        pass


def complete(job_id: str, result: dict[str, Any]) -> None:
    response = fabric_json(
        f"/api/v1/jobs/{job_id}/complete",
        {"worker_id": WORKER_ID, "result": result},
        timeout=20,
    )
    if response.get("ok") is not True:
        raise RuntimeError("job_completion_failed")


def main() -> int:
    if not FABRIC_KEY:
        raise SystemExit("IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY is required")
    if not private_or_https(FABRIC_URL):
        raise SystemExit("Fabric URL must be private HTTP or HTTPS")

    print(f"IZAKHONO media worker {WORKER_ID} starting; payloads are not logged.")
    while True:
        try:
            caps = register()
            if not caps:
                print("No healthy local media capability yet; waiting.")
                time.sleep(max(10, POLL_SECONDS))
                continue
            heartbeat(0)
            claim = fabric_json(
                f"/api/v1/workers/{WORKER_ID}/claim",
                {"lease_seconds": LEASE_SECONDS},
                timeout=20,
            )
            job = claim.get("job") if isinstance(claim, dict) else None
            if not job:
                time.sleep(POLL_SECONDS)
                continue

            job_id = job["id"]
            keeper = LeaseKeeper(job_id)
            keeper.start()
            try:
                heartbeat(1)
                result = execute_job(job)
                if keeper.failed.is_set():
                    raise RuntimeError("lease_renewal_failed")
                complete(job_id, result)
            except (ValueError, KeyError) as exc:
                fail(job_id, f"nonretryable:{type(exc).__name__}", retryable=False)
            except urllib.error.HTTPError as exc:
                retryable = exc.code >= 500 or exc.code in (408, 409, 429)
                fail(job_id, f"http_{exc.code}", retryable=retryable)
            except Exception as exc:
                fail(job_id, f"{type(exc).__name__}:{str(exc)[:300]}", retryable=True)
            finally:
                keeper.stop()
                try:
                    heartbeat(0)
                except Exception:
                    pass
        except KeyboardInterrupt:
            return 0
        except Exception as exc:
            print(f"worker_control_error={type(exc).__name__}")
            time.sleep(max(5, POLL_SECONDS))


if __name__ == "__main__":
    raise SystemExit(main())
