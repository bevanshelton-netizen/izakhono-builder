#!/usr/bin/env python3
import importlib.util
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

os.environ["IZAKHONO_AI_GATEWAY_INTERNAL_KEY"] = "gateway-test"
os.environ["IZAKHONO_AI_WORKFLOW_KEY"] = "workflow-test"
os.environ["IZAKHONO_AI_WORKFLOW_PRODUCTS"] = "venture-factory,izakhono-builder"
os.environ["IZAKHONO_ACCESS_INTERNAL_KEY"] = "access-test"
os.environ["IZAKHONO_ACCESS_URL"] = "http://127.0.0.1:19494"
os.environ["IZAKHONO_OLLAMA_URL"] = "http://127.0.0.1:19134"
os.environ["IZAKHONO_IMAGE_URL"] = "http://127.0.0.1:19222/generate"
os.environ["IZAKHONO_AI_CHAT_MODEL"] = "qwen3:4b"
os.environ["IZAKHONO_AI_CHAT_MODELS"] = "qwen3:4b,qwen3:8b"
os.environ["IZAKHONO_IMAGE_MODEL"] = "flux.1-schnell"

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
    def log_message(self, *args):
        pass

    def do_POST(self):
        n = int(self.headers.get("content-length", "0"))
        data = json.loads(self.rfile.read(n))
        assert data["model"] in ("qwen3:4b", "qwen3:8b")
        body = json.dumps({"message": {"content": "mock-response"}}).encode()
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
threading.Thread(target=a.serve_forever, daemon=True).start()
threading.Thread(target=m.serve_forever, daemon=True).start()
threading.Thread(target=i.serve_forever, daemon=True).start()

spec = importlib.util.spec_from_file_location("gateway", Path(__file__).with_name("app.py"))
g = importlib.util.module_from_spec(spec)
spec.loader.exec_module(g)

assert g.check_access("faisready-entity", "active@example.com", "faisready")["active"] is True
assert g.check_access("faisready-entity", "inactive@example.com", "faisready")["active"] is False
assert g.host_allowed("http://127.0.0.1:11434") is True
assert g.workflow_key_allowed("workflow-test", "venture-factory") is True
assert g.workflow_key_allowed("workflow-test", "izakhono-builder") is True
assert g.workflow_key_allowed("workflow-test", "other-product") is False
assert g.workflow_key_allowed("wrong-key", "venture-factory") is False

chat_cap, chat_model, chat_output, _ = g.execute_capability({
    "capability": "chat",
    "model": "qwen3:8b",
    "messages": [{"role": "user", "content": "hello"}],
})
assert chat_cap == "chat"
assert chat_model == "qwen3:8b"
assert chat_output["text"] == "mock-response"

image_cap, image_model, image_output, _ = g.execute_capability({
    "capability": "image",
    "prompt": "African future city",
})
assert image_cap == "image"
assert image_model == "flux.1-schnell"
assert image_output["data"]["asset_url"] == "owner://image/mock-1"

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
assert caps["image"]["status"] == "ready"
assert caps["video"]["status"] == "needs_backend"

assert "venture-factory" in g.WORKFLOW_PRODUCTS
print("IZAKHONO_SUPER_AI_TEST=PASS")
a.shutdown()
m.shutdown()
i.shutdown()
