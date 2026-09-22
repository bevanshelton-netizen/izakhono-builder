#!/usr/bin/env python3
import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

TARGETS = [
    {
        "slug": "edubuild-ecd360",
        "base": "https://edubuild-ecd360-staging.onrender.com",
        "role": "staging-emergency-bridge-candidate",
        "paths": ["/", "/health.json"],
    },
    {
        "slug": "legacymart",
        "base": "https://legacymart.onrender.com",
        "role": "production-fallback-candidate-from-render-service-name",
        "paths": ["/", "/health"],
    },
]

def probe(url):
    last_error = None
    for attempt in range(1, 3):
        started = time.time()
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "IZAKHONO-Wave2-External-Probe/1.0",
                "Accept": "*/*",
                "Cache-Control": "no-cache",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=75) as resp:
                status = int(resp.status)
                body = resp.read(8192)
                return {
                    "ok": 200 <= status < 400,
                    "status": status,
                    "final_url": resp.geturl(),
                    "elapsed_ms": round((time.time() - started) * 1000),
                    "body_sample": body[:240].decode("utf-8", errors="replace"),
                    "attempt": attempt,
                }
        except urllib.error.HTTPError as exc:
            last_error = {
                "ok": False,
                "status": int(exc.code),
                "final_url": exc.geturl(),
                "elapsed_ms": round((time.time() - started) * 1000),
                "error": str(exc),
                "attempt": attempt,
            }
        except Exception as exc:
            last_error = {
                "ok": False,
                "status": None,
                "final_url": url,
                "elapsed_ms": round((time.time() - started) * 1000),
                "error": f"{type(exc).__name__}: {exc}",
                "attempt": attempt,
            }
        if attempt == 1:
            time.sleep(5)
    return last_error

results = []
all_ok = True
for target in TARGETS:
    item = {
        "slug": target["slug"],
        "base_url": target["base"],
        "role": target["role"],
        "paths": [],
        "reachable": True,
    }
    for path in target["paths"]:
        result = probe(target["base"].rstrip("/") + path)
        result["path"] = path
        item["paths"].append(result)
        if not result.get("ok"):
            item["reachable"] = False
            all_ok = False
    results.append(item)

report = {
    "schema": "izakhono.wave2.external-probe.v1",
    "generated_at": datetime.now(timezone.utc).isoformat(),
    "vantage": "github-hosted-runner",
    "policy": "owned-first-externally-reversible",
    "overall": "REACHABILITY_PASS_REQUIRES_CLASSIFICATION" if all_ok else "BLOCKED",
    "note": (
        "Reachability is evidence only. It does not promote staging to production, "
        "does not authorize payments, and does not prove NODE01/EDGE readiness."
    ),
    "results": results,
}

out = Path("wave2-external-probe.json")
out.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
print(out.read_text(encoding="utf-8"))
