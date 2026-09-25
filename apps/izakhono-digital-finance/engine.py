#!/usr/bin/env python3
"""
IZAKHONO Digital Finance Academy
Independent, dependency-free HTTP engine for NODE01 and portable container deployment.

The engine deliberately contains no analytics SDK, tracking pixel, advertising identifier,
third-party authentication dependency or payment credential. Paid checkout stays gated
until a product-specific iKhokha route is verified end-to-end.
"""

from __future__ import annotations

import json
import mimetypes
import os
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse

ROOT = Path(__file__).resolve().parent
HOST = os.getenv("IZAKHONO_DF_HOST", "0.0.0.0")
PORT = int(os.getenv("IZAKHONO_DF_PORT", "8080"))

SECURITY_HEADERS = {
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "base-uri 'self'; "
        "form-action 'self'"
    ),
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": (
        "camera=(), microphone=(), geolocation=(), payment=(), "
        "usb=(), bluetooth=(), interest-cohort=()"
    ),
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}


def read_json(name: str) -> dict:
    with (ROOT / name).open("r", encoding="utf-8") as handle:
        return json.load(handle)


class AcademyHandler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-Digital-Finance/1.0"

    def log_message(self, fmt: str, *args) -> None:
        # Operational request logging only. No cookies, fingerprinting or analytics IDs.
        super().log_message(fmt, *args)

    def _headers(
        self,
        status: int,
        content_type: str,
        length: int | None = None,
        cache_control: str = "no-store",
    ) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Cache-Control", cache_control)
        for key, value in SECURITY_HEADERS.items():
            self.send_header(key, value)
        if length is not None:
            self.send_header("Content-Length", str(length))
        self.end_headers()

    def _json(self, payload: dict, status: int = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self._headers(status, "application/json; charset=utf-8", len(body))
        if self.command != "HEAD":
            self.wfile.write(body)

    def _text(
        self,
        body: str,
        status: int = HTTPStatus.OK,
        content_type: str = "text/plain; charset=utf-8",
    ) -> None:
        encoded = body.encode("utf-8")
        self._headers(status, content_type, len(encoded))
        if self.command != "HEAD":
            self.wfile.write(encoded)

    def _serve_file(self, request_path: str) -> None:
        relative = unquote(request_path.lstrip("/")) or "index.html"
        candidate = (ROOT / relative).resolve()

        try:
            candidate.relative_to(ROOT)
        except ValueError:
            self._text("Not found\n", HTTPStatus.NOT_FOUND)
            return

        if candidate.is_dir():
            candidate = candidate / "index.html"

        if not candidate.is_file():
            self._text("Not found\n", HTTPStatus.NOT_FOUND)
            return

        content = candidate.read_bytes()
        content_type, _ = mimetypes.guess_type(str(candidate))
        content_type = content_type or "application/octet-stream"
        if content_type.startswith("text/") or candidate.suffix in {".js", ".json"}:
            content_type += "; charset=utf-8"

        immutable = candidate.suffix in {".css", ".js"}
        cache = "public, max-age=300" if immutable else "no-store"
        self._headers(HTTPStatus.OK, content_type, len(content), cache)
        if self.command != "HEAD":
            self.wfile.write(content)

    def _route(self) -> None:
        path = urlparse(self.path).path

        if path == "/healthz":
            self._text("OK\n")
            return

        if path == "/api/v1/status":
            self._json(
                {
                    "service": "izakhono-digital-finance",
                    "product": "IZAKHONO Digital Finance Academy",
                    "operator": "IZAKHONO AFRICA (PTY) LTD",
                    "engine": "independent",
                    "mode": "owned-engine",
                    "status": "BUILT / VERIFIED LOCALLY",
                    "tracking": False,
                    "analytics": False,
                    "payment": {
                        "gateway": "iKhokha",
                        "state": "GATED_PENDING_VERIFIED_PRODUCT_CHECKOUT",
                    },
                }
            )
            return

        if path == "/api/v1/catalog":
            self._json(read_json("curriculum.json"))
            return

        if path == "/api/v1/platform":
            self._json(read_json("platform.json"))
            return

        if path == "/api/v1/institutions":
            self._json(read_json("institutions.json"))
            return

        if path == "/api/v1/locales":
            self._json(read_json("locales.json"))
            return

        if path == "/api/v1/payment":
            self._json(
                {
                    "enabled": False,
                    "gateway": "iKhokha",
                    "reason": "Product-specific checkout and entitlement flow are not yet verified end-to-end.",
                }
            )
            return

        self._serve_file(path)

    def do_GET(self) -> None:  # noqa: N802
        self._route()

    def do_HEAD(self) -> None:  # noqa: N802
        self._route()

    def do_POST(self) -> None:  # noqa: N802
        self._json(
            {
                "error": "write_route_not_enabled",
                "message": "This privacy-first MVP does not accept customer data or payment writes.",
            },
            HTTPStatus.METHOD_NOT_ALLOWED,
        )


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), AcademyHandler)
    print(f"IZAKHONO Digital Finance engine listening on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
