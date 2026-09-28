#!/usr/bin/env python3
import importlib.util
import json
import os
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

os.environ["IZAKHONO_AI_GATEWAY_INTERNAL_KEY"] = "gateway-test"
os.environ["IZAKHONO_AI_WORKFLOW_KEY"] = "workflow-test"
os.environ["IZAKHONO_AI_WORKFLOW_PRODUCTS"] = "venture-factory,izakhono-builder,izakhono-flow"
os.environ["IZAKHONO_ACCESS_INTERNAL_KEY"] = "access-test"
os.environ["IZAKHONO_ACCESS_URL"] = "http://127.0.0.1:19494"
os.environ["IZAKHONO_OLLAMA_URL"] = "http://127.0.0.1:19134"
os.environ["IZAKHONO_AI_OWNER_TEXT_URLS"] = "http://127.0.0.1:19135,http://127.0.0.1:19134"
os.environ["IZAKHONO_AI_OWNER_POOL_COOLDOWN_SECONDS"] = "60"
os.environ["IZAKHONO_AI_ROUTING_UNKNOWN_LATENCY_MS"] = "3000"
os.environ["IZAKHONO_AI_ROUTING_INFLIGHT_PENALTY_MS"] = "1500"
os.environ["IZAKHONO_AI_ROUTING_WARM_BONUS_MS"] = "600"
os.environ["IZAKHONO_AI_WARM_MODELS"] = "qwen3:4b"
os.environ["IZAKHONO_AI_WARM_MAX_MODELS"] = "2"
os.environ["IZAKHONO_AI_WARM_TTL_SECONDS"] = "900"
os.environ["IZAKHONO_IMAGE_URL"] = "http://127.0.0.1:19222/generate"
os.environ["IZAKHONO_AI_CHAT_MODEL"] = "qwen3:4b"
os.environ["IZAKHONO_AI_CHAT_MODELS"] = "qwen3:4b,qwen3:8b"
os.environ["IZAKHONO_IMAGE_MODEL"] = "flux.1-schnell"
os.environ["IZAKHONO_SPEECH_URL"] = "http://127.0.0.1:19231"
os.environ["IZAKHONO_SPEECH_INTERNAL_KEY"] = "speech-test"
os.environ["IZAKHONO_SPEECH_MODEL"] = "kokoro"
os.environ["IZAKHONO_VIDEO_URL"] = "http://127.0.0.1:19241"
os.environ["IZAKHONO_VIDEO_INTERNAL_KEY"] = "video-test"
os.environ["IZAKHONO_VIDEO_MODEL"] = "wan2.1"
os.environ["IZAKHONO_AI_OWNER_ONLY"] = "false"
os.environ["IZAKHONO_AI_ALLOW_EXTERNAL"] = "true"
os.environ["IZAKHONO_AI_EXTERNAL_TEXT_PROVIDER"] = "nvidia-nim"
os.environ["IZAKHONO_AI_EXTERNAL_TEXT_URL"] = "http://127.0.0.1:19333/v1"
os.environ["IZAKHONO_AI_EXTERNAL_TEXT_API_KEY"] = "external-test"
os.environ["IZAKHONO_AI_EXTERNAL_TEXT_MODEL"] = "nvidia/nemotron-3-ultra-550b-a55b"
os.environ["IZAKHONO_AI_EXTERNAL_TEXT_MODELS"] = "nvidia/nemotron-3-ultra-550b-a55b"
os.environ["IZAKHONO_AI_EXTERNAL_HOSTS"] = "127.0.0.1"

class AccessMock(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        data = json.loads(self.rfile.read(n))
        active = data.get("subject") != "inactive@example.com"
        body = json.dumps({"ok": True, "active": active}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

class ModelMock(BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *args):
        pass

    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        data = json.loads(self.rfile.read(n))
        assert data["model"] in ("qwen3:4b", "qwen3:8b")
        ModelMock.requests.append({"path": self.path, "model": data["model"], "keep_alive": data.get("keep_alive")})
        if self.path == "/api/generate":
            body = json.dumps({"response": "", "done": True}).encode()
        else:
            body = json.dumps({"message": {"content": "mock-response"}}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

class ExternalMock(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        data = json.loads(self.rfile.read(n))
        assert self.headers.get("authorization") == "Bearer external-test"
        assert data["model"] == "nvidia/nemotron-3-ultra-550b-a55b"
        body = json.dumps({"choices": [{"message": {"content": "external-mock-response"}}]}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

class SpeechMock(BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *args):
        pass

    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        data = json.loads(self.rfile.read(n))
        assert self.path == "/api/v1/generate"
        assert self.headers.get("x-izakhono-speech-key") == "speech-test"
        assert data["schema"] == "izakhono.speech.generate.v1"
        assert data["policy"]["owned_first"] is True
        assert data["policy"]["no_tracking"] is True
        SpeechMock.requests.append(data)
        body = json.dumps({
            "ok": True,
            "backend": "kokoro-local",
            "audio": {"mime": "audio/wav", "data_url": "data:audio/wav;base64,SGVsbG8="},
        }).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

class VideoMock(BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *args):
        pass

    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        data = json.loads(self.rfile.read(n))
        assert self.path == "/api/v1/generate"
        assert self.headers.get("x-izakhono-video-key") == "video-test"
        assert data["schema"] == "izakhono.video.scene.v1"
        assert data["policy"]["owned_first"] is True
        assert data["policy"]["no_tracking"] is True
        assert data["policy"]["originality_required"] is True
        VideoMock.requests.append(data)
        body = json.dumps({
            "ok": True,
            "backend": "wan-i2v-local",
            "video": {"mime": "video/mp4", "url": "http://127.0.0.1:19241/assets/mock.mp4"},
        }).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

class ImageMock(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        data = json.loads(self.rfile.read(n))
        assert data["model"] == "flux.1-schnell"
        body = json.dumps({"output": {"asset_url": "owner://image/mock-1"}}).encode()
        self.send_response(200)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

a = ThreadingHTTPServer(("127.0.0.1", 19494), AccessMock)
m = ThreadingHTTPServer(("127.0.0.1", 19134), ModelMock)
i = ThreadingHTTPServer(("127.0.0.1", 19222), ImageMock)
sp = ThreadingHTTPServer(("127.0.0.1", 19231), SpeechMock)
v = ThreadingHTTPServer(("127.0.0.1", 19241), VideoMock)
e = ThreadingHTTPServer(("127.0.0.1", 19333), ExternalMock)
threading.Thread(target=a.serve_forever, daemon=True).start()
threading.Thread(target=m.serve_forever, daemon=True).start()
threading.Thread(target=i.serve_forever, daemon=True).start()
threading.Thread(target=sp.serve_forever, daemon=True).start()
threading.Thread(target=v.serve_forever, daemon=True).start()
threading.Thread(target=e.serve_forever, daemon=True).start()

spec = importlib.util.spec_from_file_location("gateway", Path(__file__).with_name("app.py"))
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

assert g.check_access("faisready-entity", "active@example.com", "faisready")["active"] is True
assert g.check_access("faisready-entity", "inactive@example.com", "faisready")["active"] is False
assert g.host_allowed("http://127.0.0.1:11434") is True
assert g.host_allowed("http://8.8.8.8:11434") is False
assert g.owner_text_urls() == ["http://127.0.0.1:19135", "http://127.0.0.1:19134"]
assert g.ADMISSION.summary()["max_inflight"] >= 1
assert g.ADMISSION.summary()["max_queue"] >= 0
assert g.workflow_key_allowed("workflow-test", "venture-factory") is True
assert g.workflow_key_allowed("workflow-test", "izakhono-builder") is True
assert g.workflow_key_allowed("workflow-test", "izakhono-flow") is True
assert g.workflow_key_allowed("workflow-test", "other-product") is False
assert g.workflow_key_allowed("wrong-key", "venture-factory") is False

chat_cap, chat_model, chat_output, chat_raw, chat_route = g.execute_capability({
    "capability": "chat",
    "model": "qwen3:8b",
    "messages": [{"role": "user", "content": "hello"}],
})
assert chat_cap == "chat"
assert chat_model == "qwen3:8b"
assert chat_output["text"] == "mock-response"
assert chat_route == "owned"
assert chat_raw["_izakhono_owner_runtime"] == "owner-text-2"

pool = {x["runtime_id"]: x for x in g.owner_pool_summary()}
assert pool["owner-text-1"]["failures"] == 1
assert pool["owner-text-1"]["available_for_attempt"] is False
assert pool["owner-text-2"]["failures"] == 0
assert pool["owner-text-2"]["last_ok"] is not None
assert pool["owner-text-2"]["inflight"] == 0
assert pool["owner-text-2"]["latency_ewma_ms"] is not None
assert pool["owner-text-2"]["samples"] == 1
assert "qwen3:8b" in pool["owner-text-2"]["warm_models"]
assert any(x["model"] == "qwen3:8b" and x["samples"] == 1 for x in pool["owner-text-2"]["model_benchmarks"])
assert chat_raw["_izakhono_owner_runtime_elapsed_ms"] >= 0

with g.OWNER_POOL_LOCK:
    g.OWNER_POOL_STATE.clear()
    g.OWNER_POOL_STATE["http://127.0.0.1:19135"] = {"inflight": 3, "blocked_until": 0}
    g.OWNER_POOL_STATE["http://127.0.0.1:19134"] = {"inflight": 0, "blocked_until": 0}
assert g.owner_pool_candidates("qwen3:4b")[0] == "http://127.0.0.1:19134"

# Benchmark-aware routing prefers the lower predicted latency when load is equal.
with g.OWNER_POOL_LOCK:
    g.OWNER_POOL_STATE.clear()
    g.OWNER_POOL_STATE["http://127.0.0.1:19135"] = {
        "inflight": 0,
        "blocked_until": 0,
        "model_stats": {"qwen3:4b": {"latency_ewma_ms": 900, "samples": 3}},
    }
    g.OWNER_POOL_STATE["http://127.0.0.1:19134"] = {
        "inflight": 0,
        "blocked_until": 0,
        "model_stats": {"qwen3:4b": {"latency_ewma_ms": 120, "samples": 3}},
    }
assert g.owner_pool_candidates("qwen3:4b")[0] == "http://127.0.0.1:19134"

# Explicit warm management only targets sanitized owner runtime IDs and approved models.
with g.OWNER_POOL_LOCK:
    g.OWNER_POOL_STATE.clear()
warm = g.warm_owner_pool(models=["qwen3:4b"], runtime_ids=["owner-text-2"])
assert warm["attempted"] == 1
assert warm["succeeded"] == 1
assert warm["failed"] == 0
assert ModelMock.requests[-1]["path"] == "/api/generate"
assert ModelMock.requests[-1]["model"] == "qwen3:4b"
assert ModelMock.requests[-1]["keep_alive"] == g.OWNER_WARM_KEEP_ALIVE
warm_state = {x["runtime_id"]: x for x in g.owner_pool_summary()}
assert "qwen3:4b" in warm_state["owner-text-2"]["warm_models"]
assert g.warm_pool_summary()["active_runtime_model_pairs"] >= 1

try:
    g.warm_owner_pool(models=["not-allowed"], runtime_ids=["owner-text-2"])
    raise AssertionError("warm pool accepted a disallowed model")
except ValueError as exc:
    assert str(exc) == "warm_model_not_allowed"

with g.OWNER_POOL_LOCK:
    g.OWNER_POOL_STATE.clear()

external_cap, external_model, external_output, _, external_route = g.execute_capability({
    "capability": "code",
    "route": "external",
    "data_classification": "public",
    "messages": [{"role": "user", "content": "review this public example"}],
})
assert external_cap == "code"
assert external_model == "nvidia/nemotron-3-ultra-550b-a55b"
assert external_output["text"] == "external-mock-response"
assert external_route == "external"
assert g.external_text_configured() is True

controller = g.AdmissionController(1, 1, 0.25)
controller.acquire()
waiter_acquired = threading.Event()

def queued_waiter():
    controller.acquire()
    try:
        waiter_acquired.set()
    finally:
        controller.release()

waiter = threading.Thread(target=queued_waiter, daemon=True)
waiter.start()
for _ in range(50):
    if controller.summary()["queued"] == 1:
        break
    time.sleep(0.01)
assert controller.summary()["queued"] == 1
try:
    controller.acquire()
    raise AssertionError("full admission queue accepted another request")
except g.CapacityUnavailable as exc:
    assert str(exc) == "queue_full"

controller.release()
waiter.join(timeout=2)
assert waiter_acquired.is_set()
summary = controller.summary()
assert summary["inflight"] == 0
assert summary["queued"] == 0
assert summary["rejected"] == 1
assert summary["completed"] == 2

timeout_controller = g.AdmissionController(1, 1, 0.05)
timeout_controller.acquire()
try:
    timeout_controller.acquire()
    raise AssertionError("admission queue timeout did not fire")
except g.CapacityUnavailable as exc:
    assert str(exc) == "queue_timeout"
finally:
    timeout_controller.release()

try:
    g.execute_capability({
        "capability": "code",
        "route": "external",
        "data_classification": "confidential",
        "messages": [{"role": "user", "content": "private source"}],
    })
    raise AssertionError("external route accepted confidential data")
except ValueError as exc:
    assert str(exc) == "external_route_requires_public_data"

image_cap, image_model, image_output, _, image_route = g.execute_capability({
    "capability": "image",
    "prompt": "African future city",
})
assert image_cap == "image"
assert image_model == "flux.1-schnell"
assert image_output["data"]["asset_url"] == "owner://image/mock-1"
assert image_route == "owned"

speech_cap, speech_model, speech_output, speech_raw, speech_route = g.execute_capability({
    "capability": "speech",
    "input": "Welcome to IZAKHONO.",
    "options": {"language": "English", "voice": "af_heart", "speed": 1.05},
})
assert speech_cap == "speech"
assert speech_model == "kokoro"
assert speech_route == "owned"
assert speech_output["data"]["audio"]["mime"] == "audio/wav"
assert speech_raw["backend"] == "kokoro-local"
assert SpeechMock.requests[-1]["text"] == "Welcome to IZAKHONO."
assert SpeechMock.requests[-1]["voice"] == "af_heart"
assert SpeechMock.requests[-1]["speed"] == 1.05

video_cap, video_model, video_output, video_raw, video_route = g.execute_capability({
    "capability": "video",
    "prompt": "Animate this original explorer looking up at the moon.",
    "source_image": "data:image/png;base64,AA==",
    "options": {"duration_seconds": 7, "aspect_ratio": "9:16"},
})
assert video_cap == "video"
assert video_model == "wan2.1"
assert video_route == "owned"
assert video_output["data"]["video"]["mime"] == "video/mp4"
assert video_raw["backend"] == "wan-i2v-local"
assert VideoMock.requests[-1]["duration_seconds"] == 7
assert VideoMock.requests[-1]["source_image"] == "data:image/png;base64,AA=="

try:
    g.execute_capability({
        "capability": "video",
        "prompt": "missing source",
    })
    raise AssertionError("video capability accepted a request without source_image")
except ValueError as exc:
    assert str(exc) == "video_source_image_required"

try:
    g.execute_capability({
        "capability": "chat",
        "model": "not-allowed",
        "messages": [{"role": "user", "content": "hello"}],
    })
    raise AssertionError("model allowlist did not reject")
except ValueError as exc:
    assert str(exc) == "model_not_allowed"

caps = {x["capability"]: x for x in g.capability_summary()}
assert caps["chat"]["status"] == "ready"
assert len(g.owner_pool_summary()) == 2
assert g.ADMISSION.summary()["completed"] >= 4
assert g.warm_pool_summary()["configured_model_count"] == 1
assert caps["image"]["status"] == "ready"
assert caps["speech"]["status"] == "ready"
assert caps["video"]["status"] == "ready"

assert "venture-factory" in g.WORKFLOW_PRODUCTS
assert "izakhono-flow" in g.WORKFLOW_PRODUCTS
print("IZAKHONO_SUPER_AI_TEST=PASS")
a.shutdown()
m.shutdown()
i.shutdown()
sp.shutdown()
v.shutdown()
e.shutdown()
