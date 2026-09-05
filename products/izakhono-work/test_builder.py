#!/usr/bin/env python3
import json
import tempfile
from pathlib import Path

from builder_core import BuilderEngine, BuilderError, WorkspaceManager


def assert_raises(fn):
    try:
        fn()
    except BuilderError:
        return
    raise AssertionError("expected BuilderError")


with tempfile.TemporaryDirectory() as td:
    ws = WorkspaceManager(Path(td))

    responses = [
        json.dumps({
            "summary": "Created a standalone owner app.",
            "done": True,
            "actions": [
                {
                    "type": "write_file",
                    "path": "index.html",
                    "content": "<!doctype html><title>IZAKHONO Builder Ready</title><h1>READY</h1>"
                },
                {
                    "type": "write_file",
                    "path": "config.json",
                    "content": "{\"owner\":true,\"builder\":\"ready\"}"
                }
            ]
        })
    ]

    def model_call(_messages):
        return responses.pop(0)

    result = BuilderEngine(ws, model_call, max_turns=2).build(
        "Create a tiny standalone status page",
        "builder-smoke"
    )
    assert result["project"] == "builder-smoke"
    assert result["validation_ok"] is True
    assert result["preview_url"] == "/preview/builder-smoke/"
    assert (Path(td) / "projects" / "builder-smoke" / "index.html").exists()
    assert (Path(td) / "projects" / "builder-smoke" / "config.json").exists()

    assert_raises(lambda: ws.write_file("builder-smoke", "../escape.txt", "no"))

    ws.write_file("restore-test", "note.txt", "version-one")
    cp = ws.checkpoint("restore-test", "known-good")
    ws.write_file("restore-test", "note.txt", "version-two")
    ws.restore_checkpoint("restore-test", cp)
    assert ws.read_file("restore-test", "note.txt") == "version-one"

print("IZAKHONO_WORK_BUILDER_TEST=PASS")
