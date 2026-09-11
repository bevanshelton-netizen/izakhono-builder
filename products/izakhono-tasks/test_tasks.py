#!/usr/bin/env python3
import importlib.util
import os
import tempfile
from pathlib import Path

tmp=tempfile.TemporaryDirectory()
os.environ["IZAKHONO_TASKS_DB"]=str(Path(tmp.name)/"tasks.db")
os.environ["IZAKHONO_TASKS_POLL_SECONDS"]="60"

spec=importlib.util.spec_from_file_location("tasksapp",Path(__file__).with_name("app.py"))
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

# Core requirement: no artificial five-active-task ceiling.
created=[]
for i in range(25):
    created.append(m.create_task({
        "entity_id":"entity-a",
        "title":f"Task {i}",
        "instruction":"Do the scheduled work.",
        "task_mode":"scheduled",
        "schedule":{"kind":"interval","seconds":3600}
    }))
assert len(m.list_tasks("entity-a"))==25
assert all(t["enabled"] for t in m.list_tasks("entity-a"))

# Entity isolation.
m.create_task({
    "entity_id":"entity-b",
    "title":"Other entity",
    "instruction":"Stay isolated.",
    "schedule":{"kind":"daily","time":"08:00","timezone_offset_minutes":120}
})
assert len(m.list_tasks("entity-b"))==1
assert len(m.list_tasks("entity-a"))==25

# Pause / resume / delete.
first=created[0]
assert m.set_enabled(first["id"],"entity-a",False)["enabled"] is False
assert m.set_enabled(first["id"],"entity-a",True)["enabled"] is True
assert m.delete_task(first["id"],"entity-a") is True
assert len(m.list_tasks("entity-a"))==24

# Minimum interval protects the node from accidental tight loops.
try:
    m.schedule_next({"kind":"interval","seconds":30})
    raise AssertionError("expected validation failure")
except ValueError:
    pass

print("IZAKHONO_TASKS_TEST=PASS")
tmp.cleanup()
