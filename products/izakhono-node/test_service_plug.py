#!/usr/bin/env python3
import importlib.util
import os
import tempfile
from pathlib import Path

tmp=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_NODE_ROOT"]=tmp.name
spec=importlib.util.spec_from_file_location("iznode",Path(__file__).resolve().parents[1]/"node_agent.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

ok,err=m.valid_job({
  "app":"allegro-radio",
  "repo":"https://github.com/bevanshelton-netizen/allegro-vibez.git",
  "ref":"main",
  "mode":"compose",
  "compose_file":"radio/owner-node/docker-compose.yml",
  "health_url":"http://127.0.0.1:8000/status-json.xsl",
  "env_file":"/etc/izakhono/apps/allegro-radio.env"
})
assert ok,err

ok,err=m.valid_job({
  "app":"bad",
  "repo":"https://example.com/repo.git",
  "ref":"main",
  "mode":"compose",
  "compose_file":"docker-compose.yml",
  "health_url":"https://public.example.com/health"
})
assert not ok and "localhost" in err

ok,err=m.valid_job({
  "app":"single-app",
  "repo":"https://example.com/repo.git",
  "ref":"main",
  "container_port":8080,
  "health_path":"/healthz"
})
assert ok,err

print("IZAKHONO_SERVICE_PLUG_TEST=PASS")
tmp.cleanup()
