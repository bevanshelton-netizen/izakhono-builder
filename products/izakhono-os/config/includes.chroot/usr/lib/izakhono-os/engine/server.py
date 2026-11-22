#!/usr/bin/env python3
"""Local Unix-domain socket service; deliberately no TCP listener."""
from __future__ import annotations

import json
import os
import socket
import socketserver
import stat
from pathlib import Path

from engine import IzakhonoOsEngine

SOCKET_PATH = Path(os.environ.get("IZAKHONO_OS_ENGINE_SOCKET", "/run/izakhono-engine/engine.sock"))
MAX_REQUEST_BYTES = 65536
ENGINE = IzakhonoOsEngine()


class Handler(socketserver.StreamRequestHandler):
    def handle(self) -> None:
        raw = self.rfile.readline(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            response = {"ok": False, "error": "request_too_large"}
        else:
            try:
                request = json.loads(raw.decode("utf-8"))
                response = ENGINE.dispatch(request)
            except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as error:
                response = {"ok": False, "error": str(error)}
        self.wfile.write((json.dumps(response, separators=(",", ":")) + "\n").encode("utf-8"))


class UnixServer(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True
    allow_reuse_address = True


def main() -> None:
    SOCKET_PATH.parent.mkdir(parents=True, exist_ok=True)
    if SOCKET_PATH.exists() or SOCKET_PATH.is_symlink():
        if not stat.S_ISSOCK(SOCKET_PATH.lstat().st_mode):
            raise RuntimeError("refusing to replace a non-socket path")
        SOCKET_PATH.unlink()
    with UnixServer(str(SOCKET_PATH), Handler) as server:
        os.chmod(SOCKET_PATH, 0o660)
        try:
            server.serve_forever()
        finally:
            try:
                SOCKET_PATH.unlink()
            except FileNotFoundError:
                pass


if __name__ == "__main__":
    main()
