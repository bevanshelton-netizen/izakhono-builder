#!/usr/bin/env python3
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import time
import uuid
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

HOST = os.getenv("IZAKHONO_ID_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_ID_PORT", "9696"))
DATA_DIR = Path(os.getenv("IZAKHONO_ID_DATA", "./data"))
DB_PATH = DATA_DIR / "identity.db"
ADMIN_KEY = os.getenv("IZAKHONO_ID_ADMIN_KEY", "")
INTERNAL_KEY = os.getenv("IZAKHONO_ID_INTERNAL_KEY", "")
SESSION_HOURS = int(os.getenv("IZAKHONO_ID_SESSION_HOURS", "12"))
PBKDF2_ITERATIONS = int(os.getenv("IZAKHONO_ID_PBKDF2_ITERATIONS", "600000"))
MAX_BODY = 200_000

def now():
    return datetime.now(timezone.utc)

def now_iso():
    return now().isoformat()

def parse_iso(value):
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))

def safe_equal(a, b):
    return hmac.compare_digest(str(a), str(b))

def sha256_hex(value):
    return hashlib.sha256(str(value).encode()).hexdigest()

def clean_email(value):
    email = str(value or "").strip().lower()
    if not email or len(email) > 254 or "@" not in email:
        raise ValueError("invalid_email")
    return email

def clean_slug(value, field="slug"):
    s = str(value or "").strip().lower()
    allowed = set("abcdefghijklmnopqrstuvwxyz0123456789-_")
    if not s or len(s) > 80 or any(ch not in allowed for ch in s):
        raise ValueError(f"invalid_{field}")
    return s

def hash_password(password, salt=None):
    password = str(password or "")
    if len(password) < 12:
        raise ValueError("password_too_short")
    salt_bytes = secrets.token_bytes(16) if salt is None else bytes.fromhex(salt)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt_bytes, PBKDF2_ITERATIONS)
    return salt_bytes.hex(), digest.hex()

def verify_password(password, salt, expected):
    try:
        _, actual = hash_password(password, salt=salt)
        return safe_equal(actual, expected)
    except Exception:
        return False

def db_connect():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("""CREATE TABLE IF NOT EXISTS entities(
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS users(
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS memberships(
      id TEXT PRIMARY KEY,
      entity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      UNIQUE(entity_id,user_id),
      FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )""")
    db.execute("""CREATE TABLE IF NOT EXISTS sessions(
      id TEXT PRIMARY KEY,
      token_hash TEXT NOT NULL UNIQUE,
      entity_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      membership_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      FOREIGN KEY(entity_id) REFERENCES entities(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(membership_id) REFERENCES memberships(id) ON DELETE CASCADE
    )""")
    db.commit()
    return db

def issue_session(db, entity, user, membership):
    token = secrets.token_urlsafe(48)
    session_id = "ses_" + uuid.uuid4().hex
    created = now()
    expires = created + timedelta(hours=SESSION_HOURS)
    db.execute("""INSERT INTO sessions(id,token_hash,entity_id,user_id,membership_id,created_at,expires_at)
                  VALUES(?,?,?,?,?,?,?)""",
               (session_id, sha256_hex(token), entity["id"], user["id"], membership["id"], created.isoformat(), expires.isoformat()))
    db.commit()
    return token, session_id, expires.isoformat()

def find_session(db, token):
    if not token:
        return None
    row = db.execute("""SELECT s.*, e.slug AS entity_slug, e.display_name AS entity_name,
                              u.email AS user_email, m.role AS membership_role,
                              e.status AS entity_status, u.status AS user_status, m.status AS membership_status
                       FROM sessions s
                       JOIN entities e ON e.id=s.entity_id
                       JOIN users u ON u.id=s.user_id
                       JOIN memberships m ON m.id=s.membership_id
                       WHERE s.token_hash=?""", (sha256_hex(token),)).fetchone()
    if not row or row["revoked_at"]:
        return None
    if parse_iso(row["expires_at"]) <= now():
        return None
    if row["entity_status"] != "active" or row["user_status"] != "active" or row["membership_status"] != "active":
        return None
    return row

def bearer_token(handler):
    value = handler.headers.get("authorization", "")
    if value.lower().startswith("bearer "):
        return value[7:].strip()
    return ""

def send_json(handler, status, obj):
    body = json.dumps(obj, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(body)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.end_headers()
    handler.wfile.write(body)

class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoID/0.1"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def read_json(self):
        n = int(self.headers.get("content-length", "0") or "0")
        if n <= 0 or n > MAX_BODY:
            raise ValueError("invalid_body_size")
        return json.loads(self.rfile.read(n).decode())

    def admin_authorized(self):
        supplied = self.headers.get("x-izakhono-id-admin-key", "")
        return bool(ADMIN_KEY and supplied and safe_equal(supplied, ADMIN_KEY))

    def internal_authorized(self):
        supplied = self.headers.get("x-izakhono-id-internal-key", "")
        return bool(INTERNAL_KEY and supplied and safe_equal(supplied, INTERNAL_KEY))

    def do_GET(self):
        p = urlparse(self.path).path
        if p == "/healthz":
            return send_json(self, 200, {
                "ok": True,
                "service": "izakhono-id",
                "entity_isolation": True,
                "session_scope": "entity",
            })
        if p == "/api/v1/me":
            token = bearer_token(self)
            with db_connect() as db:
                session = find_session(db, token)
            if not session:
                return send_json(self, 401, {"ok": False, "error": "invalid_session"})
            return send_json(self, 200, {
                "ok": True,
                "subject": session["user_email"],
                "entity": {
                    "id": session["entity_id"],
                    "slug": session["entity_slug"],
                    "display_name": session["entity_name"],
                },
                "role": session["membership_role"],
                "session_expires_at": session["expires_at"],
            })
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        p = urlparse(self.path).path

        if p == "/api/v1/admin/entities":
            if not self.admin_authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            try:
                data = self.read_json()
                slug = clean_slug(data.get("slug"), "entity_slug")
                display_name = str(data.get("display_name") or "").strip()[:160]
                if not display_name:
                    raise ValueError("display_name_required")
                entity_id = "ent_" + uuid.uuid4().hex
                with db_connect() as db:
                    db.execute("INSERT INTO entities(id,slug,display_name,created_at) VALUES(?,?,?,?)",
                               (entity_id, slug, display_name, now_iso()))
                    db.commit()
                return send_json(self, 201, {"ok": True, "entity": {"id": entity_id, "slug": slug, "display_name": display_name}})
            except sqlite3.IntegrityError:
                return send_json(self, 409, {"ok": False, "error": "entity_exists"})
            except (ValueError, json.JSONDecodeError) as exc:
                return send_json(self, 422, {"ok": False, "error": str(exc)})

        if p == "/api/v1/admin/users":
            if not self.admin_authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            try:
                data = self.read_json()
                email = clean_email(data.get("email"))
                password = str(data.get("password") or "")
                salt, digest = hash_password(password)
                with db_connect() as db:
                    existing = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
                    if existing:
                        return send_json(self, 409, {"ok": False, "error": "user_exists"})
                    user_id = "usr_" + uuid.uuid4().hex
                    ts = now_iso()
                    db.execute("""INSERT INTO users(id,email,password_salt,password_hash,created_at,updated_at)
                                  VALUES(?,?,?,?,?,?)""", (user_id, email, salt, digest, ts, ts))
                    db.commit()
                return send_json(self, 201, {"ok": True, "user": {"id": user_id, "email": email}})
            except (ValueError, json.JSONDecodeError) as exc:
                return send_json(self, 422, {"ok": False, "error": str(exc)})

        if p == "/api/v1/admin/memberships":
            if not self.admin_authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            try:
                data = self.read_json()
                entity_slug = clean_slug(data.get("entity_slug"), "entity_slug")
                email = clean_email(data.get("email"))
                role = clean_slug(data.get("role") or "member", "role")
                with db_connect() as db:
                    entity = db.execute("SELECT * FROM entities WHERE slug=?", (entity_slug,)).fetchone()
                    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
                    if not entity or not user:
                        return send_json(self, 404, {"ok": False, "error": "entity_or_user_not_found"})
                    membership_id = "mem_" + uuid.uuid4().hex
                    db.execute("INSERT INTO memberships(id,entity_id,user_id,role,created_at) VALUES(?,?,?,?,?)",
                               (membership_id, entity["id"], user["id"], role, now_iso()))
                    db.commit()
                return send_json(self, 201, {"ok": True, "membership": {"id": membership_id, "entity_slug": entity_slug, "email": email, "role": role}})
            except sqlite3.IntegrityError:
                return send_json(self, 409, {"ok": False, "error": "membership_exists"})
            except (ValueError, json.JSONDecodeError) as exc:
                return send_json(self, 422, {"ok": False, "error": str(exc)})

        if p == "/api/v1/login":
            try:
                data = self.read_json()
                entity_slug = clean_slug(data.get("entity_slug"), "entity_slug")
                email = clean_email(data.get("email"))
                password = str(data.get("password") or "")
                with db_connect() as db:
                    entity = db.execute("SELECT * FROM entities WHERE slug=? AND status='active'", (entity_slug,)).fetchone()
                    user = db.execute("SELECT * FROM users WHERE email=? AND status='active'", (email,)).fetchone()
                    if not entity or not user or not verify_password(password, user["password_salt"], user["password_hash"]):
                        return send_json(self, 401, {"ok": False, "error": "invalid_credentials"})
                    membership = db.execute("""SELECT * FROM memberships
                                               WHERE entity_id=? AND user_id=? AND status='active'""",
                                            (entity["id"], user["id"])).fetchone()
                    if not membership:
                        return send_json(self, 403, {"ok": False, "error": "entity_membership_required"})
                    token, session_id, expires_at = issue_session(db, entity, user, membership)
                return send_json(self, 200, {
                    "ok": True,
                    "access_token": token,
                    "token_type": "Bearer",
                    "session_id": session_id,
                    "expires_at": expires_at,
                    "entity": {"id": entity["id"], "slug": entity["slug"]},
                    "subject": email,
                    "role": membership["role"],
                })
            except (ValueError, json.JSONDecodeError) as exc:
                return send_json(self, 422, {"ok": False, "error": str(exc)})

        if p == "/api/v1/logout":
            token = bearer_token(self)
            with db_connect() as db:
                session = find_session(db, token)
                if session:
                    db.execute("UPDATE sessions SET revoked_at=? WHERE id=?", (now_iso(), session["id"]))
                    db.commit()
            return send_json(self, 200, {"ok": True})

        if p == "/api/v1/internal/introspect":
            if not self.internal_authorized():
                return send_json(self, 401, {"ok": False, "error": "unauthorized"})
            try:
                data = self.read_json()
                token = str(data.get("token") or "")
                with db_connect() as db:
                    session = find_session(db, token)
                if not session:
                    return send_json(self, 200, {"ok": True, "active": False})
                return send_json(self, 200, {
                    "ok": True,
                    "active": True,
                    "subject": session["user_email"],
                    "entity_id": session["entity_id"],
                    "entity_slug": session["entity_slug"],
                    "role": session["membership_role"],
                    "expires_at": session["expires_at"],
                })
            except Exception:
                return send_json(self, 422, {"ok": False, "error": "invalid_request"})

        return send_json(self, 404, {"ok": False, "error": "not_found"})

if __name__ == "__main__":
    db_connect().close()
    print(f"IZAKHONO ID listening on http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
