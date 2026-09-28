#!/usr/bin/env python3
import base64
import importlib.util
import json
import os
import tempfile
import time
from pathlib import Path

TMP = tempfile.TemporaryDirectory()
ROOT = Path(TMP.name)
os.environ["IZAKHONO_MEDIA_FABRIC_INTERNAL_KEY"] = "fabric-test"
os.environ["IZAKHONO_MEDIA_FABRIC_PAYLOAD_KEY"] = base64.urlsafe_b64encode(b"k" * 32).decode("ascii")
os.environ["IZAKHONO_MEDIA_FABRIC_DB"] = str(ROOT / "fabric.db")
os.environ["IZAKHONO_MEDIA_FABRIC_ARTIFACT_ROOT"] = str(ROOT / "artifacts")
os.environ["IZAKHONO_MEDIA_FABRIC_ASSET_BASE_URL"] = "http://127.0.0.1:19751"
os.environ["IZAKHONO_MEDIA_FABRIC_REPLICATED_STORAGE"] = "true"
os.environ["IZAKHONO_MEDIA_FABRIC_RETRY_BASE_SECONDS"] = "1"

SPEC = importlib.util.spec_from_file_location("fabric", Path(__file__).with_name("app.py"))
fabric = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(fabric)
fabric.init_db()

def submit(capability, payload, min_gpu_mb=0, max_attempts=3):
    return fabric.submit_job({
        "schema": "izakhono.media.job.submit.v1",
        "capability": capability,
        "payload": payload,
        "priority": 60,
        "max_attempts": max_attempts,
        "min_gpu_mb": min_gpu_mb,
        "policy": {"owned_first": True, "no_tracking": True},
    })

speech_payload = {
    "schema": "izakhono.speech.generate.v1",
    "text": "This plaintext must be encrypted at rest.",
    "language": "English",
    "voice": "af_heart",
    "format": "wav",
    "speed": 1.0,
}
speech = submit("speech", speech_payload)
assert speech["status"] == "queued"
assert speech["job_token"]
assert speech["deduplicated"] is False
assert fabric.verify_job_token(speech["id"], speech["job_token"]) is True
assert fabric.verify_job_token(speech["id"], "wrong") is False

with fabric.connect() as con:
    row = con.execute("SELECT payload_cipher FROM jobs WHERE id=?", (speech["id"],)).fetchone()
    raw = bytes(row["payload_cipher"])
    assert b"This plaintext must be encrypted at rest." not in raw

worker = fabric.register_worker({
    "worker_id": "node-test-media",
    "node_id": "node-test",
    "capabilities": ["speech", "video"],
    "gpu": {"available": True, "memory_mb": 16000, "memory_free_mb": 15000},
    "labels": {"owned": True},
    "max_jobs": 1,
    "version": "test",
})
assert worker["registered"] is True

claimed = fabric.claim_job("node-test-media", lease_seconds=60)
assert claimed["id"] == speech["id"]
assert claimed["payload"]["text"].startswith("This plaintext")
assert claimed["attempt"] == 1

heartbeat = fabric.heartbeat_worker(
    "node-test-media",
    {"gpu": {"available": True, "memory_mb": 16000, "memory_free_mb": 14500}, "active_jobs": 0},
)
assert heartbeat["active_jobs"] == 1, "heartbeat must derive active leases, not trust caller counters"

artifact = fabric.save_artifact(
    speech["id"], "node-test-media", "speech.wav", "audio/wav", b"RIFF" + b"x" * 5000
)
assert artifact["bytes"] == 5004
assert len(artifact["sha256"]) == 64

done = fabric.complete_job(
    speech["id"], "node-test-media",
    {"backend": "kokoro-local", "artifact": {"name": "speech.wav"}}
)
assert done["status"] == "complete"
status = fabric.job_status(speech["id"])
assert status["status"] == "complete"
assert status["result"]["backend"] == "kokoro-local"
assert status["artifacts"][0]["name"] == "speech.wav"

# GPU-aware scheduling: an 8 GB worker cannot claim a 12 GB job.
video_payload = {
    "schema": "izakhono.video.scene.v1",
    "prompt": "Original vertical scene",
    "source_image": "data:image/png;base64,AA==",
    "duration_seconds": 5,
    "aspect_ratio": "9:16",
    "policy": {"owned_first": True, "no_tracking": True, "originality_required": True},
}
video = submit("video", video_payload, min_gpu_mb=12000)
fabric.heartbeat_worker(
    "node-test-media",
    {"gpu": {"available": True, "memory_mb": 16000, "memory_free_mb": 8000}},
)
assert fabric.claim_job("node-test-media", lease_seconds=60) is None

fabric.heartbeat_worker(
    "node-test-media",
    {"gpu": {"available": True, "memory_mb": 16000, "memory_free_mb": 15000}},
)
claimed_video = fabric.claim_job("node-test-media", lease_seconds=60)
assert claimed_video["id"] == video["id"]

# Lease renewal changes the deadline.
old_until = claimed_video["lease_until"]
renewed = fabric.renew_lease(video["id"], "node-test-media", 120)
assert renewed["lease_until"] >= old_until

# Retry path returns the job to the queue with backoff.
failed = fabric.fail_job(video["id"], "node-test-media", "temporary GPU pressure", retryable=True)
assert failed["status"] == "queued"
with fabric.connect() as con:
    con.execute("UPDATE jobs SET run_after=? WHERE id=?", (fabric.now_ts() - 1, video["id"]))
claimed_again = fabric.claim_job("node-test-media", lease_seconds=60)
assert claimed_again["id"] == video["id"]
assert claimed_again["attempt"] == 2

# Expired leases are requeued and worker accounting is decremented.
with fabric.connect() as con:
    con.execute("UPDATE jobs SET lease_until=? WHERE id=?", (fabric.now_ts() - 1, video["id"]))
    before = con.execute("SELECT active_jobs FROM workers WHERE id='node-test-media'").fetchone()["active_jobs"]
    assert before == 1
    fabric.requeue_expired(con)
    after = con.execute("SELECT active_jobs FROM workers WHERE id='node-test-media'").fetchone()["active_jobs"]
    state = con.execute("SELECT status FROM jobs WHERE id=?", (video["id"],)).fetchone()["status"]
    assert after == 0
    assert state == "queued"

h = fabric.health()
assert h["ok"] is True
assert h["replicated_storage"] is True
assert h["production_ready"] is True
assert h["encrypted_payloads_at_rest"] is True
assert h["raw_prompt_logging"] is False

# Bad privacy policy must fail closed.
try:
    fabric.submit_job({
        "schema": "izakhono.media.job.submit.v1",
        "capability": "speech",
        "payload": {"text": "bad"},
        "policy": {"owned_first": True, "no_tracking": False},
    })
    raise AssertionError("privacy policy accepted")
except ValueError as exc:
    assert str(exc) == "owned_privacy_policy_required"

print("IZAKHONO_MEDIA_FABRIC_TEST=PASS")
TMP.cleanup()
