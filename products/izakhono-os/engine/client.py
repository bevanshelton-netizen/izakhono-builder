#!/usr/bin/env python3
"""CLI client for the local allow-listed IZAKHONO OS engine."""
from __future__ import annotations

import argparse
import json
import os
import socket
from pathlib import Path

ACTIONS = (
    "system.status",
    "apps.list",
    "privacy.status",
    "migration.preview",
    "updates.status",
    "help.topics",
)


def request(action: str, params: dict | None = None) -> dict:
    if action not in ACTIONS:
        raise ValueError("action is not allow-listed")
    path = os.environ.get("IZAKHONO_OS_ENGINE_SOCKET", "/run/izakhono-engine/engine.sock")
    payload = json.dumps({"action": action, "params": params or {}}).encode("utf-8") + b"\n"
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        client.settimeout(3)
        client.connect(path)
        client.sendall(payload)
        response = b""
        while not response.endswith(b"\n"):
            chunk = client.recv(4096)
            if not chunk:
                break
            response += chunk
            if len(response) > 65536:
                raise ValueError("engine response too large")
    return json.loads(response.decode("utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser(description="IZAKHONO OS local engine client")
    parser.add_argument("action", choices=ACTIONS)
    args = parser.parse_args()
    print(json.dumps(request(args.action), indent=2))


if __name__ == "__main__":
    main()
