#!/usr/bin/env bash
set -euo pipefail

# IZAKHONO NODE CLUSTER HEALTH GATE
# NODE01-NODE04 are software/runtime identities, never physical-machine names.
# Each endpoint must use HTTPS, a unique per-node credential, a fresh HMAC
# challenge response, and an actual HTTP 200 response.

NODE01_URL="${NODE01_URL:-}"
NODE02_URL="${NODE02_URL:-}"
NODE03_URL="${NODE03_URL:-}"
NODE04_URL="${NODE04_URL:-}"
NODE01_HEALTH_TOKEN="${NODE01_HEALTH_TOKEN:-}"
NODE02_HEALTH_TOKEN="${NODE02_HEALTH_TOKEN:-}"
NODE03_HEALTH_TOKEN="${NODE03_HEALTH_TOKEN:-}"
NODE04_HEALTH_TOKEN="${NODE04_HEALTH_TOKEN:-}"
OUTPUT="${OUTPUT:-node-cluster-health.json}"
TIMEOUT="${TIMEOUT:-8}"

command -v curl >/dev/null 2>&1 || { echo "curl is required" >&2; exit 2; }

python3 - "$OUTPUT" "$TIMEOUT" "$NODE01_URL" "$NODE02_URL" "$NODE03_URL" "$NODE04_URL" \
  "$NODE01_HEALTH_TOKEN" "$NODE02_HEALTH_TOKEN" "$NODE03_HEALTH_TOKEN" "$NODE04_HEALTH_TOKEN" <<'PY'
import hashlib
import hmac
import json
import re
import secrets
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from urllib.parse import urlsplit

output, timeout, *values = sys.argv[1:]
urls = values[:4]
tokens = values[4:]
names = ["NODE01", "NODE02", "NODE03", "NODE04"]
cluster = "izakhono-production"
scheme = "bearer-hmac-sha256"
results = []

for name, url, token in zip(names, urls, tokens):
    checked = datetime.now(timezone.utc).isoformat()
    base = {"node": name, "identityType": "software-runtime", "physicalHostIsSeparate": True, "checkedAt": checked}
    if not url:
        results.append({**base, "status": "MISSING_ENDPOINT", "runtime_evidence": False})
        continue
    if not token:
        results.append({**base, "status": "MISSING_CREDENTIAL", "runtime_evidence": False})
        continue
    if not re.fullmatch(r"[a-fA-F0-9]{64}", token):
        results.append({**base, "status": "INVALID_CREDENTIAL", "runtime_evidence": False})
        continue
    try:
        parsed_url = urlsplit(url)
        _ = parsed_url.port
        if parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username or parsed_url.password:
            raise ValueError("HTTPS URL with a hostname and no embedded credentials is required")
    except Exception:
        results.append({**base, "status": "INVALID_HTTPS_URL", "runtime_evidence": False})
        continue
    if urls.count(url) != 1:
        results.append({**base, "status": "DUPLICATE_ENDPOINT", "runtime_evidence": False})
        continue
    if tokens.count(token) != 1:
        results.append({**base, "status": "DUPLICATE_CREDENTIAL", "runtime_evidence": False})
        continue

    nonce = secrets.token_hex(32)
    try:
        # Capture the HTTP status separately from the signed JSON body. curl
        # does not follow redirects; only an actual HTTP 200 can be healthy.
        with tempfile.NamedTemporaryFile(prefix="connecta-node-health-", delete=True) as body_file:
            p = subprocess.run(
                [
                    "curl", "--proto", "=https", "--silent", "--show-error",
                    "--max-time", timeout, "--output", body_file.name,
                    "--write-out", "%{http_code}",
                    "--header", f"Authorization: Bearer {token}",
                    "--header", f"X-IZAKHONO-Probe-Nonce: {nonce}",
                    url,
                ],
                capture_output=True, text=True, check=False,
            )
            body_file.seek(0)
            body = body_file.read().decode("utf-8", errors="replace").strip()
        try:
            http_status = int(p.stdout.strip())
        except Exception:
            http_status = 0
        payload = json.loads(body) if body else {}
        identity_matches = (
            isinstance(payload, dict)
            and payload.get("ok") is True
            and payload.get("runtimeNode") == name
            and payload.get("cluster") == cluster
            and payload.get("authScheme") == scheme
        )
        supplied_nonce = payload.get("probeNonce") if isinstance(payload, dict) else None
        supplied_signature = payload.get("probeSignature") if isinstance(payload, dict) else None
        expected_signature = hmac.new(
            bytes.fromhex(token),
            f"{cluster}\n{name}\n{nonce}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()
        challenge_verified = (
            supplied_nonce == nonce
            and isinstance(supplied_signature, str)
            and hmac.compare_digest(supplied_signature, expected_signature)
        )
        healthy = p.returncode == 0 and http_status == 200 and identity_matches and challenge_verified
        results.append({
            **base,
            "runtimeNode": payload.get("runtimeNode") if isinstance(payload, dict) else None,
            "status": "PASS" if healthy else "HTTP_IDENTITY_OR_CHALLENGE_MISMATCH",
            "runtime_evidence": healthy,
            "authentication": {"scheme": scheme, "challengeVerified": challenge_verified},
            "probeNonce": nonce,
            "probeSignature": supplied_signature if challenge_verified else None,
            "http": {
                "status": http_status,
                "ok": payload.get("ok") if isinstance(payload, dict) else False,
                "cluster": payload.get("cluster") if isinstance(payload, dict) else None,
                "runtimeNode": payload.get("runtimeNode") if isinstance(payload, dict) else None,
                "authScheme": payload.get("authScheme") if isinstance(payload, dict) else None,
            },
            "exitCode": p.returncode,
        })
    except Exception as exc:
        results.append({
            **base, "status": "ERROR", "runtime_evidence": False, "error": str(exc),
        })

healthy = [r["node"] for r in results if r["runtime_evidence"]]
passed = len(healthy) == 4
record = {
    "schema": "izakhono.node-cluster-health.v1",
    "cluster": cluster,
    "nodeIdentityType": "software-runtime",
    "physicalHostIsSeparate": True,
    "authentication": {"scheme": scheme, "perNodeCredentials": True},
    "checkedAt": datetime.now(timezone.utc).isoformat(),
    "nodes": results,
    "healthyNodes": healthy,
    "requiredHealthyNodes": 4,
    "status": "PASS" if passed else "BLOCKED",
    "runtimeEvidence": True,
    "source": "operator-supplied-authenticated-runtime-endpoints",
}
with open(output, "w", encoding="utf-8") as f:
    json.dump(record, f, indent=2)
    f.write("\n")

print(json.dumps({"status": record["status"], "healthyNodes": healthy, "output": output}))
PY

if python3 - "$OUTPUT" <<'PY'
import json, sys
with open(sys.argv[1], encoding="utf-8") as f: d=json.load(f)
sys.exit(0 if d.get("status") == "PASS" and d.get("nodeIdentityType") == "software-runtime" and d.get("physicalHostIsSeparate") is True and d.get("authentication", {}).get("scheme") == "bearer-hmac-sha256" else 1)
PY
then
  exit 0
fi
exit 1
