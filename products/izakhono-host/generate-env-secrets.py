#!/usr/bin/env python3
"""Generate missing IZAKHONO HOST internal secrets without rotating existing credentials."""
from pathlib import Path
import secrets

path = Path(__file__).resolve().parent / ".env"
if not path.is_file():
    raise SystemExit(".env is missing; copy .env.example to .env first")

generated = {
    "HOST_RUNTIME_TOKEN": secrets.token_urlsafe(48),
    "POSTGRES_PASSWORD": secrets.token_urlsafe(32),
    "MINIO_ROOT_PASSWORD": secrets.token_urlsafe(32),
    "IZAKHONO_MAIL_API_TOKEN": secrets.token_urlsafe(48),
    "COMPUTE_ADMIN_TOKEN": secrets.token_urlsafe(48),
    "COMPUTE_WORKER_TOKEN": secrets.token_urlsafe(48),
    "STALWART_RECOVERY_ADMIN": "admin:" + secrets.token_urlsafe(32),
}
lines = path.read_text().splitlines()
seen = set()
for index, line in enumerate(lines):
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue
    key, value = line.split("=", 1)
    key = key.strip()
    if key in generated:
        seen.add(key)
        if not value.strip() or value.startswith("replace-with") or "replace-with-" in value:
            lines[index] = key + "=" + generated[key]
missing = set(generated) - seen
if missing:
    raise SystemExit("Missing required secret settings: " + ", ".join(sorted(missing)))
path.write_text("\n".join(lines) + "\n")
print("Generated missing internal secrets. Existing configured secrets were preserved.")
