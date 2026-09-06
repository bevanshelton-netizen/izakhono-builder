#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import sqlite3
import time
import uuid
from datetime import datetime, timezone, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_ACCESS_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_ACCESS_PORT", "9494"))
DATA_DIR = Path(os.getenv("IZAKHONO_ACCESS_DATA", "./data"))
DB_PATH = DATA_DIR / "access.db"
PAY_WEBHOOK_SECRET = os.getenv("IZAKHONO_PAY_WEBHOOK_SECRET", "")
INTERNAL_API_KEY = os.getenv("IZAKHONO_ACCESS_INTERNAL_KEY", "")
MAX_BODY = 200_000
CLOCK_SKEW_SECONDS = 300

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def parse_iso(value):
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))

def db_connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("""CREATE TABLE IF NOT EXISTS entitlements(
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      subject TEXT NOT NULL,
      product_slug TEXT NOT NULL,
      plan_slug TEXT NOT NULL,
      status TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      expires_at TEXT,
      source_event_id TEXT NOT NULL UNIQUE,
      source_reference TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(entity_id, subject, product_slug)
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS events(
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      entity_id TEXT,
      subject TEXT,
      product_slug TEXT,
      payload_json TEXT NOT NULL,
      received_at TEXT NOT NULL
    )""")
    db.commit()
    return db

def json_bytes(obj):
    return json.dumps(obj, separators=(",", ":"), sort_keys=True).encode()

def response(handler, status, obj):
    body = json_bytes(obj)
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)

def safe_equal(a, b):
    return hmac.compare_digest(str(a), str(b))

def verify_pay_signature(raw, timestamp, signature):
    if not PAY_WEBHOOK_SECRET or not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except Exception:
        return False
    if abs(int(time.time()) - ts) > CLOCK_SKEW_SECONDS:
        return False
    expected = hmac.new(
        PAY_WEBHOOK_SECRET.encode(),
        f"{timestamp}.".encode() + raw,
        hashlib.sha256,
    ).hexdigest()
    return safe_equal(expected, signature)

def clean_subject(value):
    s = str(value or "").strip().lower()
    if not s or len(s) > 254:
        raise ValueError("invalid_subject")
    return s

def clean_slug(value, field):
    s = str(value or "").strip().lower()
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-_")
    if not s or len(s) > 80 or any(ch not in allowed for ch in s):
        raise ValueError(f"invalid_{field}")
    return s

def grant_from_payment(db, payload):
    event_id = str(payload.get("event_id") or "")
    if payload.get("event") != "payment.paid" or not event_id:
        raise ValueError("unsupported_event")

    intent = payload.get("intent") or {}
    metadata = intent.get("metadata") or {}
    entity_id = clean_slug(metadata.get("access_entity_id"), "entity_id")
    subject = clean_subject(metadata.get("access_subject") or metadata.get("customer_email"))
    product = clean_slug(metadata.get("access_product"), "product")
    plan = clean_slug(metadata.get("access_plan") or "subscriber", "plan")
    days = int(metadata.get("access_period_days") or 30)
    if days < 1 or days > 3660:
        raise ValueError("invalid_access_period_days")

    existing_event = db.execute("SELECT event_id FROM events WHERE event_id=?", (event_id,)).fetchone()
    if existing_event:
        row = db.execute("SELECT * FROM entitlements WHERE source_event_id=? OR (entity_id=? AND subject=? AND product_slug=?)",
                         (event_id, entity_id, subject, product)).fetchone()
        return dict(row) if row else None

    now = datetime.now(timezone.utc)
    current = db.execute("SELECT * FROM entitlements WHERE entity_id=? AND subject=? AND product_slug=?",
                         (entity_id, subject, product)).fetchone()

    if current and current["expires_at"]:
        current_expiry = parse_iso(current["expires_at"])
        base = current_expiry if current_expiry > now else now
    else:
        base = now
    expires = base + timedelta(days=days)

    db.execute(
        "INSERT INTO events(event_id,event_type,entity_id,subject,product_slug,payload_json,received_at) VALUES(?,?,?,?,?,?,?)",
        (event_id, "payment.paid", entity_id, subject, product, json.dumps(payload)[:100000], now_iso()),
    )

    if current:
        db.execute("""UPDATE entitlements
          SET plan_slug=?,status='active',starts_at=?,expires_at=?,source_event_id=?,source_reference=?,updated_at=?
          WHERE entity_id=? AND subject=? AND product_slug=?""",
          (plan, current["starts_at"], expires.isoformat(), event_id, str(intent.get("reference") or ""), now_iso(), entity_id, subject, product))
    else:
        db.execute("""INSERT INTO entitlements(
          id,entity_id,subject,product_slug,plan_slug,status,starts_at,expires_at,source_event_id,source_reference,created_at,updated_at
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
          ("ent_"+uuid.uuid4().hex, entity_id, subject, product, plan, "active", now.isoformat(), expires.isoformat(),
           event_id, str(intent.get("reference") or ""), now_iso(), now_iso()))
    db.commit()
    row = db.execute("SELECT * FROM entitlements WHERE entity_id=? AND subject=? AND product_slug=?", (entity_id, subject, product)).fetchone()
    return dict(row)


def grant_bundle_from_payment(db, payload):
    event_id = str(payload.get("event_id") or "")
    if payload.get("event") != "payment.paid" or not event_id:
        raise ValueError("unsupported_event")

    intent = payload.get("intent") or {}
    metadata = intent.get("metadata") or {}
    grants = metadata.get("access_grants")
    if not isinstance(grants, list) or not grants:
        single = grant_from_payment(db, payload)
        return [single] if single else []
    if len(grants) > 100:
        raise ValueError("too_many_access_grants")

    subject_default = clean_subject(metadata.get("access_subject") or metadata.get("customer_email"))
    existing_event = db.execute("SELECT event_id FROM events WHERE event_id=?", (event_id,)).fetchone()
    if existing_event:
        rows = db.execute(
            "SELECT * FROM entitlements WHERE source_event_id LIKE ? ORDER BY entity_id,product_slug",
            (event_id + ":%",),
        ).fetchall()
        return [dict(row) for row in rows]

    normalized = []
    for grant in grants:
        if not isinstance(grant, dict):
            raise ValueError("invalid_access_grant")
        entity_id = clean_slug(grant.get("entity_id"), "entity_id")
        product = clean_slug(grant.get("product"), "product")
        plan = clean_slug(grant.get("plan") or metadata.get("access_plan") or "umbrella", "plan")
        days = int(grant.get("period_days") or metadata.get("access_period_days") or 30)
        if days < 1 or days > 3660:
            raise ValueError("invalid_access_period_days")
        subject = clean_subject(grant.get("subject") or subject_default)
        normalized.append((entity_id, subject, product, plan, days))

    db.execute(
        "INSERT INTO events(event_id,event_type,entity_id,subject,product_slug,payload_json,received_at) VALUES(?,?,?,?,?,?,?)",
        (event_id, "payment.paid", None, subject_default, "izakhono-one", json.dumps(payload)[:100000], now_iso()),
    )

    now = datetime.now(timezone.utc)
    out = []
    for entity_id, subject, product, plan, days in normalized:
        current = db.execute(
            "SELECT * FROM entitlements WHERE entity_id=? AND subject=? AND product_slug=?",
            (entity_id, subject, product),
        ).fetchone()
        if current and current["expires_at"]:
            current_expiry = parse_iso(current["expires_at"])
            base = current_expiry if current_expiry > now else now
        else:
            base = now
        expires = base + timedelta(days=days)
        source_id = f"{event_id}:{entity_id}:{product}"

        if current:
            db.execute("""UPDATE entitlements
              SET plan_slug=?,status='active',starts_at=?,expires_at=?,source_event_id=?,source_reference=?,updated_at=?
              WHERE entity_id=? AND subject=? AND product_slug=?""",
              (plan, current["starts_at"], expires.isoformat(), source_id,
               str(intent.get("reference") or ""), now_iso(), entity_id, subject, product))
        else:
            db.execute("""INSERT INTO entitlements(
              id,entity_id,subject,product_slug,plan_slug,status,starts_at,expires_at,source_event_id,source_reference,created_at,updated_at
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)""",
              ("ent_"+uuid.uuid4().hex, entity_id, subject, product, plan, "active", now.isoformat(),
               expires.isoformat(), source_id, str(intent.get("reference") or ""), now_iso(), now_iso()))
        row = db.execute(
            "SELECT * FROM entitlements WHERE entity_id=? AND subject=? AND product_slug=?",
            (entity_id, subject, product),
        ).fetchone()
        out.append(dict(row))
    db.commit()
    return out


def normalized_access(row):
    if not row:
        return {
            "active": False,
            "entitlement": None,
            "usage_policy": {
                "usage_credit_gate": False,
                "message_quota": None,
                "session_quota": None,
                "fair_use": True,
            },
        }
    expiry = parse_iso(row["expires_at"]) if row["expires_at"] else None
    active = row["status"] == "active" and (expiry is None or expiry > datetime.now(timezone.utc))
    return {
        "active": active,
        "entitlement": {
            "entity_id": row["entity_id"],
            "subject": row["subject"],
            "product": row["product_slug"],
            "plan": row["plan_slug"],
            "starts_at": row["starts_at"],
            "expires_at": row["expires_at"],
        },
        "usage_policy": {
            "usage_credit_gate": False,
            "message_quota": None,
            "session_quota": None,
            "fair_use": True,
        },
    }

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoAccess/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def read_body(self):
        n = int(self.headers.get("content-length", "0") or "0")
        if n <= 0 or n > MAX_BODY:
            raise ValueError("invalid_body_size")
        return self.rfile.read(n)

    def internal_authorized(self):
        supplied = self.headers.get("x-izakhono-access-key", "")
        return bool(INTERNAL_API_KEY and supplied and safe_equal(supplied, INTERNAL_API_KEY))

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/healthz":
            return response(self, 200, {
                "ok": True,
                "service": "izakhono-access",
                "usage_credit_gate": False,
                "subscriber_message_quota": None,
            })
        return response(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/webhooks/izakhono-pay":
            try:
                raw = self.read_body()
            except ValueError as e:
                return response(self, 400, {"ok": False, "error": str(e)})
            timestamp = self.headers.get("x-izakhono-timestamp", "")
            signature = self.headers.get("x-izakhono-signature", "")
            if not verify_pay_signature(raw, timestamp, signature):
                return response(self, 401, {"ok": False, "error": "invalid_signature"})
            try:
                payload = json.loads(raw.decode())
                with db_connect() as db:
                    entitlements = grant_bundle_from_payment(db, payload)
                return response(self, 200, {
                    "ok": True,
                    "entitlement": entitlements[0] if entitlements else None,
                    "entitlements": entitlements,
                    "umbrella": len(entitlements) > 1,
                })
            except (ValueError, json.JSONDecodeError) as e:
                return response(self, 422, {"ok": False, "error": str(e)})

        if path == "/api/v1/check":
            if not self.internal_authorized():
                return response(self, 401, {"ok": False, "error": "unauthorized"})
            try:
                payload = json.loads(self.read_body().decode())
                entity_id = clean_slug(payload.get("entity_id"), "entity_id")
                subject = clean_subject(payload.get("subject"))
                product = clean_slug(payload.get("product"), "product")
                with db_connect() as db:
                    row = db.execute("SELECT * FROM entitlements WHERE entity_id=? AND subject=? AND product_slug=?",
                                     (entity_id, subject, product)).fetchone()
                return response(self, 200, {"ok": True, **normalized_access(row)})
            except (ValueError, json.JSONDecodeError) as e:
                return response(self, 422, {"ok": False, "error": str(e)})

        return response(self, 404, {"ok": False, "error": "not_found"})

if __name__ == "__main__":
    db_connect().close()
    print(f"IZAKHONO ACCESS listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
