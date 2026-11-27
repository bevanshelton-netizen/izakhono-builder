#!/usr/bin/env python3
"""Private, self-hostable Topic PDF rendering adapter.

Run behind an IZAKHONO private network or localhost reverse proxy. The service
only renders editorial drafts and always retains the renderer's NOT FOR SALE
watermark. It does not publish, store, sell or deliver PDFs.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
RENDERER = ROOT / "render-pdf.py"
MAX_BODY = 600_000
MAX_PDF = 25 * 1024 * 1024


def clean_text(value: Any, limit: int = 20_000) -> str:
    if not isinstance(value, str):
        return ""
    return value.replace("\x00", "").strip()[:limit]


def manuscript_to_markdown(manuscript: dict[str, Any]) -> str:
    title = clean_text(manuscript.get("title"), 180) or "Untitled topic guide"
    subtitle = clean_text(manuscript.get("subtitle"), 260)
    author = clean_text(manuscript.get("author"), 120) or "Bevan Shelton"
    language = clean_text(manuscript.get("language"), 80)
    geography = clean_text(manuscript.get("geography"), 160)
    version = clean_text(manuscript.get("version"), 80) or "0.1-editorial-draft"
    sections = manuscript.get("sections")
    if not isinstance(sections, list) or not 5 <= len(sections) <= 40:
        raise ValueError("Manuscript must contain 5-40 sections.")

    lines = [
        "# " + title,
        "## " + subtitle,
        "**Author:** " + author,
        "**Edition:** " + " · ".join(part for part in [language, geography, version] if part),
        "**Status:** EDITORIAL DRAFT — NOT FOR SALE",
        "",
        "---",
        "",
    ]
    for section in sections:
        if not isinstance(section, dict):
            raise ValueError("Invalid manuscript section.")
        heading = clean_text(section.get("heading"), 180)
        body = clean_text(section.get("body"), 18_000)
        if len(heading) < 3 or len(body) < 350:
            raise ValueError("Every section requires a heading and developed prose.")
        lines.extend(["## " + heading, ""])
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", body) if part.strip()]
        for paragraph in paragraphs:
            lines.extend([paragraph, ""])

    sources = manuscript.get("sources")
    if not isinstance(sources, list) or not 2 <= len(sources) <= 30:
        raise ValueError("A source ledger of 2-30 sources is required.")
    lines.extend(["## Research sources", ""])
    for index, source in enumerate(sources, start=1):
        if not isinstance(source, dict):
            raise ValueError("Invalid source record.")
        title = clean_text(source.get("title"), 240)
        publisher = clean_text(source.get("publisher"), 160)
        url = clean_text(source.get("url"), 1000)
        supports = source.get("supports")
        if not title or not publisher or not url.startswith("https://") or not isinstance(supports, list) or not supports:
            raise ValueError("Source record is incomplete or unsafe.")
        lines.extend([
            f"- **[S{index}] {title}** — {publisher}",
            f"  {url}",
            f"  Accessed: {clean_text(source.get('accessedAt'), 40)}",
            "",
        ])
    lines.extend([
        "## Editorial status",
        "",
        "This document is an editorial draft for review. It has not been approved for sale or public distribution. Claims, sources, rights, language quality and jurisdictional relevance require human review.",
    ])
    return "\n".join(lines) + "\n"


def render_manuscript(manuscript: dict[str, Any]) -> bytes:
    markdown = manuscript_to_markdown(manuscript)
    with tempfile.TemporaryDirectory(prefix="izakhono-topic-pdf-") as directory:
        source = Path(directory) / "manuscript.md"
        output = Path(directory) / "editorial-draft.pdf"
        source.write_text(markdown, encoding="utf-8")
        result = subprocess.run(
            ["python3", str(RENDERER), str(source), str(output)],
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
        )
        if result.returncode != 0 or not output.is_file():
            raise RuntimeError("PDF renderer failed: " + (result.stderr[-1200:] or result.stdout[-1200:]))
        payload = output.read_bytes()
        if not payload.startswith(b"%PDF-") or len(payload) < 1000 or len(payload) > MAX_PDF:
            raise RuntimeError("Renderer returned an invalid or oversized PDF.")
        return payload


class Handler(BaseHTTPRequestHandler):
    server_version = "IZAKHONO-TopicPDF-Renderer/1.0"

    def _send(self, status: int, body: bytes, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path != "/health":
            self._send(404, b'{"ok":false,"error":"Not found."}')
            return
        self._send(200, b'{"ok":true,"service":"topic-pdf-renderer","mode":"draft-only"}')

    def do_POST(self) -> None:
        if self.path != "/render":
            self._send(404, b'{"ok":false,"error":"Not found."}')
            return
        token = os.environ.get("TOPIC_PDF_RENDER_TOKEN", "")
        if not token or self.headers.get("Authorization", "") != "Bearer " + token:
            self._send(401, b'{"ok":false,"error":"Unauthorized."}')
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length < 2 or length > MAX_BODY:
            self._send(413, b'{"ok":false,"error":"Request body size is invalid."}')
            return
        try:
            body = self.rfile.read(length)
            payload = json.loads(body.decode("utf-8"))
            manuscript = payload.get("manuscript") if isinstance(payload, dict) else None
            if not isinstance(manuscript, dict):
                raise ValueError("manuscript object is required.")
            pdf = render_manuscript(manuscript)
            self._send(200, pdf, "application/pdf")
        except (ValueError, UnicodeDecodeError, json.JSONDecodeError) as error:
            self._send(400, json.dumps({"ok": False, "error": str(error)}).encode())
        except Exception as error:
            self._send(500, json.dumps({"ok": False, "error": str(error)[:1000]}).encode())

    def log_message(self, format: str, *args: Any) -> None:
        # Avoid writing request bodies, bearer tokens or manuscript content to logs.
        print("topic-pdf-renderer " + (format % args))


def main() -> None:
    if not os.environ.get("TOPIC_PDF_RENDER_TOKEN"):
        raise SystemExit("TOPIC_PDF_RENDER_TOKEN must be configured.")
    host = os.environ.get("TOPIC_PDF_RENDER_HOST", "127.0.0.1")
    port = int(os.environ.get("TOPIC_PDF_RENDER_PORT", "8788"))
    ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
