#!/usr/bin/env python3
import importlib.util
import os
import tempfile
from pathlib import Path

tmp = tempfile.TemporaryDirectory()
os.environ["IZAKHONO_NODE_ROOT"] = tmp.name
os.environ["IZAKHONO_NODE_SECRET"] = "test-secret-do-not-use"
os.environ["IZAKHONO_NODE_ALLOWED_REPO_PREFIXES"] = "file:///srv/izakhono-code/repos/;https://github.com/bevanshelton-netizen/"

spec = importlib.util.spec_from_file_location(
    "iznode", Path(__file__).resolve().parent / "node_agent.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

ok, err = module.valid_job({
    "app": "allegro-radio",
    "repo": "file:///srv/izakhono-code/repos/allegro-vibez.git",
    "ref": "main",
    "mode": "compose",
    "environment": "staging",
    "compose_file": "radio/owner-node/docker-compose.yml",
    "health_url": "http://127.0.0.1:8000/status-json.xsl",
    "env_file": "/etc/izakhono/apps/allegro-radio.env",
})
assert ok, err

ok, err = module.valid_job({
    "app": "allegro-vibez",
    "repo": "file:///srv/izakhono-code/repos/allegro-vibez.git",
    "ref": "a" * 40,
    "mode": "single",
    "environment": "production",
    "container_port": 8080,
    "health_path": "/healthz",
    "public_url": "https://allegro.example.test",
    "public_build_env_file": "/etc/izakhono/apps/allegro-vibez.public-build.env",
})
assert ok, err

ok, err = module.valid_job({
    "app": "allegro-vibez",
    "repo": "file:///srv/izakhono-code/repos/allegro-vibez.git",
    "ref": "main",
    "mode": "single",
    "environment": "production",
    "container_port": 8080,
    "health_path": "/healthz",
})
assert not ok and "immutable" in err

ok, err = module.valid_job({
    "app": "bad-build-env",
    "repo": "file:///srv/izakhono-code/repos/allegro-vibez.git",
    "ref": "main",
    "mode": "single",
    "container_port": 8080,
    "health_path": "/healthz",
    "public_build_env_file": "/tmp/browser.env",
})
assert not ok and "public_build_env_file" in err

ok, err = module.valid_job({
    "app": "bad-source",
    "repo": "https://example.com/repo.git",
    "ref": "main",
    "mode": "single",
    "container_port": 8080,
    "health_path": "/healthz",
})
assert not ok and "allow-list" in err

ok, err = module.valid_job({
    "app": "bad-public",
    "repo": "file:///srv/izakhono-code/repos/example.git",
    "ref": "main",
    "mode": "compose",
    "compose_file": "docker-compose.yml",
    "health_url": "https://public.example.com/health",
})
assert not ok and "localhost" in err

headers = {
    "X-IZAKHONO-Timestamp": "0",
    "X-IZAKHONO-Nonce": "test",
    "X-IZAKHONO-Signature": "invalid",
}
ok, _ = module.verify(headers, b"{}")
assert not ok

print("IZAKHONO_NODE_V1_TEST=PASS")
tmp.cleanup()
