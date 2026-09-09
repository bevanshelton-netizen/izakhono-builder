#!/usr/bin/env python3
import importlib.util
import os
from pathlib import Path

os.environ["IZAKHONO_CONTROL_TOKEN"] = "owner-test"
os.environ["IZAKHONO_NODE_SECRET"] = "node-test"
os.environ["IZAKHONO_CODE_REPOS"] = "/srv/izakhono-code/repos"

spec = importlib.util.spec_from_file_location(
    "izcontrol", Path(__file__).resolve().parent / "control.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

job = module.normalize_job({
    "source": "izakhono-code",
    "repository": "allegro-vibez",
    "app": "allegro-vibez",
    "ref": "b" * 40,
    "environment": "production",
    "mode": "single",
    "container_port": 8080,
    "health_path": "/healthz",
})
assert job["repo"] == "file:///srv/izakhono-code/repos/allegro-vibez.git"
assert job["idempotency_key"]
assert job["environment"] == "production"

try:
    module.normalize_job({
        "source": "izakhono-code",
        "repository": "allegro-vibez",
        "app": "allegro-vibez",
        "ref": "main",
        "environment": "production",
    })
except ValueError as exc:
    assert "immutable" in str(exc)
else:
    raise AssertionError("Production branch ref was accepted.")

mirror = module.normalize_job({
    "source": "github-mirror",
    "repository": "allegro-vibez",
    "app": "allegro-vibez",
    "ref": "main",
    "environment": "staging",
    "mode": "single",
    "container_port": 8080,
    "health_path": "/healthz",
})
assert mirror["repo"] == "https://github.com/bevanshelton-netizen/allegro-vibez.git"

print("IZAKHONO_CONTROL_V1_TEST=PASS")
