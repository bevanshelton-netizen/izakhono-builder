#!/usr/bin/env python3
import importlib.util, os, tempfile
from pathlib import Path

tmp=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_RUNNER_DB"]=str(Path(tmp.name)/"runner.db")
os.environ["IZAKHONO_RUNNER_SECRET"]="test-secret"

spec=importlib.util.spec_from_file_location("runner",Path(__file__).with_name("runner_service.py"))
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

task={"id":"t1","entity_id":"e1","title":"x","instruction":"x","task_mode":"condition_watch","runner_spec":{"type":"website_watch","url":"https://example.com"}}

# Simulate watch behavior without network.
samples=[
 {"status":200,"content_type":"text/html","hash":"a","preview":"one","bytes":3},
 {"status":200,"content_type":"text/html","hash":"a","preview":"one","bytes":3},
 {"status":200,"content_type":"text/html","hash":"b","preview":"two","bytes":3}
]
def fake_fetch(url): return samples.pop(0)
m.fetch=fake_fetch

r1=m.execute(task); assert r1["notify"] is False and r1["changed"] is True
r2=m.execute(task); assert r2["notify"] is False and r2["changed"] is False
r3=m.execute(task); assert r3["notify"] is True and r3["changed"] is True

# Entity isolation of watch state.
assert m.state_get("e2","t1","https://example.com") is None

# Private target protection stays on by default.
try:
    m.public_target("http://127.0.0.1:9999")
    raise AssertionError("private target should be blocked")
except ValueError:
    pass

print("IZAKHONO_RUNNER_TEST=PASS")
