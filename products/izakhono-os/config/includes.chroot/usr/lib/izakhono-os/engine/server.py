#!/usr/bin/env python3
import json
import os
import socketserver
import stat
from pathlib import Path
from engine import IzakhonoOsEngine

SOCKET_PATH = Path(os.environ.get("IZAKHONO_OS_ENGINE_SOCKET", "/run/izakhono-engine/engine.sock"))
ENGINE = IzakhonoOsEngine()

class Handler(socketserver.StreamRequestHandler):
    def handle(self):
        raw = self.rfile.readline(65537)
        try:
            if len(raw) > 65536:
                raise ValueError("request too large")
            response = ENGINE.dispatch(json.loads(raw.decode("utf-8")))
        except Exception as error:
            response = {"ok": False, "error": str(error)}
        self.wfile.write((json.dumps(response, separators=(",", ":")) + "\\n").encode("utf-8"))

class UnixServer(socketserver.ThreadingUnixStreamServer):
    daemon_threads = True
    allow_reuse_address = True

def main():
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
