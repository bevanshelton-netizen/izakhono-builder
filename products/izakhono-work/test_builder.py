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


    # A real owner laptop can occasionally get a syntactically valid model plan
    # with no file actions. Static-page requests must still produce a concrete,
    # validated artifact rather than being reported as a successful zero-file build.
    def empty_model_call(_messages):
        return json.dumps({
            "summary": "No file actions emitted.",
            "done": True,
            "actions": []
        })

    fallback = BuilderEngine(ws, empty_model_call, max_turns=2).build(
        'Create one complete static webpage in index.html. Display "IZAKHONO OWNER NODE ACTIVE", "6 September 2026", and "Built locally on the owner laptop".',
        "owner-node-proof-fallback"
    )
    assert fallback["fallback_used"] is True
    assert fallback["validation_ok"] is True
    assert fallback["preview_url"] == "/preview/owner-node-proof-fallback/"
    fallback_html = ws.read_file("owner-node-proof-fallback", "index.html")
    assert "IZAKHONO OWNER NODE ACTIVE" in fallback_html
    assert "6 September 2026" in fallback_html
    assert "Built locally on the owner laptop" in fallback_html

    assert_raises(lambda: BuilderEngine(ws, empty_model_call, max_turns=1).build(
        "Create an unspecified backend service",
        "must-not-fake-output"
    ))

    assert_raises(lambda: ws.write_file("builder-smoke", "../escape.txt", "no"))

    ws.write_file("restore-test", "note.txt", "version-one")
    cp = ws.checkpoint("restore-test", "known-good")
    ws.write_file("restore-test", "note.txt", "version-two")
    ws.restore_checkpoint("restore-test", cp)
    assert ws.read_file("restore-test", "note.txt") == "version-one"

print("IZAKHONO_WORK_BUILDER_TEST=PASS")
