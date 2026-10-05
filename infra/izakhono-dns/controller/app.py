import os
import subprocess
from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="IZAKHONO DNS Controller", version="0.1.0")

PRIMARY = os.getenv("DNS_PRIMARY_HOST", "127.0.0.1")
PORT = os.getenv("DNS_PRIMARY_PORT", "53")
API_KEY = os.getenv("DNS_API_KEY", "change-me-before-production")
ZONE = "izakhonoafrica.co.za."
KEY_FILE = "/secrets/izakhono-controller.key"

class Record(BaseModel):
    name: str = Field(min_length=1, max_length=253)
    record_type: str = Field(pattern="^(A|AAAA|CNAME|TXT|MX|SRV)$")
    value: str = Field(min_length=1, max_length=2048)
    ttl: int = Field(default=300, ge=30, le=86400)


def auth(x_api_key: str | None):
    if not x_api_key or x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid API key")


def fqdn(name: str) -> str:
    clean = name.strip()
    if clean in ("@", ""):
        return ZONE
    if clean.endswith("."):
        return clean
    return clean + "." + ZONE


def run_update(record: Record, delete: bool = False):
    name = fqdn(record.name)
    rr = record.record_type
    cmd = ["nsupdate", "-k", KEY_FILE]
    lines = [f"server {PRIMARY} {PORT}", f"zone {ZONE}"]
    if delete:
        lines.append(f"update delete {name} {rr}")
    else:
        lines.append(f"update delete {name} {rr}")
        lines.append(f"update add {name} {record.ttl} {rr} {record.value}")
    lines += ["send", ""]
    result = subprocess.run(cmd, input="\n".join(lines), text=True, capture_output=True, timeout=10)
    if result.returncode != 0:
        raise HTTPException(status_code=502, detail=result.stderr.strip() or "DNS update failed")
    return {"status": "ok", "name": name, "type": rr, "deleted": delete}


@app.get("/health")
def health():
    return {"service": "izakhono-dns-controller", "status": "ok"}


@app.post("/v1/records")
def create_record(record: Record, x_api_key: str | None = Header(default=None)):
    auth(x_api_key)
    return run_update(record)


@app.delete("/v1/records")
def delete_record(record: Record, x_api_key: str | None = Header(default=None)):
    auth(x_api_key)
    return run_update(record, delete=True)


@app.get("/v1/resolve/{hostname}")
def resolve(hostname: str, x_api_key: str | None = Header(default=None)):
    auth(x_api_key)
    target = hostname if hostname.endswith(".") else hostname + "."
    result = subprocess.run(["dig", "+short", target, "@" + PRIMARY], capture_output=True, text=True, timeout=5)
    return {"hostname": target, "answers": [x for x in result.stdout.splitlines() if x]}
