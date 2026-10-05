"""Secure account recovery and email-verification primitives for IZAKHONO ID.

This module is intentionally provider-neutral. It stores only hashes of one-time
secrets and sends mail through owner-controlled SMTP when configured. It does not
know the caller's HTTP framework, so the identity service can expose these
primitives without coupling customer access to a third-party identity vendor.
"""
from __future__ import annotations

import hashlib
import os
import secrets
import smtplib
import sqlite3
import time
import uuid
from email.message import EmailMessage
from typing import Optional

TOKEN_BYTES = int(os.getenv("IZAKHONO_ID_RECOVERY_TOKEN_BYTES", "32"))
TOKEN_SECONDS = int(os.getenv("IZAKHONO_ID_RECOVERY_TOKEN_SECONDS", "900"))
MAX_ATTEMPTS = int(os.getenv("IZAKHONO_ID_RECOVERY_MAX_ATTEMPTS", "5"))
REQUEST_WINDOW_SECONDS = int(os.getenv("IZAKHONO_ID_RECOVERY_WINDOW_SECONDS", "900"))
REQUEST_MAX = int(os.getenv("IZAKHONO_ID_RECOVERY_MAX_REQUESTS", "5"))
PUBLIC_BASE_URL = os.getenv("IZAKHONO_ID_PUBLIC_BASE_URL", "").rstrip("/")
MAIL_MODE = os.getenv("IZAKHONO_ID_EMAIL_MODE", "smtp").strip().lower()
SMTP_HOST = os.getenv("IZAKHONO_ID_SMTP_HOST", "")
SMTP_PORT = int(os.getenv("IZAKHONO_ID_SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("IZAKHONO_ID_SMTP_USERNAME", "")
SMTP_PASSWORD = os.getenv("IZAKHONO_ID_SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("IZAKHONO_ID_SMTP_FROM", "")
SMTP_STARTTLS = os.getenv("IZAKHONO_ID_SMTP_STARTTLS", "true").lower() != "false"


def token_hash(token: str) -> str:
    return hashlib.sha256(str(token).encode("utf-8")).hexdigest()


def normalize_token(token: str) -> str:
    return str(token or "").strip()


def issue_token(db: sqlite3.Connection, user_id: str, kind: str,
                entity_id: Optional[str] = None, seconds: int = TOKEN_SECONDS) -> str:
    """Create a single-use secret; only its SHA-256 hash is persisted."""
    token = secrets.token_urlsafe(TOKEN_BYTES)
    now = int(time.time())
    db.execute(
        "INSERT INTO account_tokens(id,user_id,entity_id,kind,token_hash,attempts,created_at,expires_at) "
        "VALUES(?,?,?,?,?,?,?,?)",
        ("act_" + uuid.uuid4().hex, user_id, entity_id, kind, token_hash(token), 0, now, now + max(60, int(seconds))),
    )
    return token


def consume_token(db: sqlite3.Connection, token: str, kind: str):
    """Atomically consume a valid, unexpired token and return its row."""
    token = normalize_token(token)
    if not token:
        return None
    row = db.execute(
        "SELECT * FROM account_tokens WHERE token_hash=? AND kind=?",
        (token_hash(token), kind),
    ).fetchone()
    if not row or row["consumed_at"] is not None:
        return None
    if int(row["expires_at"]) <= int(time.time()) or int(row["attempts"] or 0) >= MAX_ATTEMPTS:
        return None
    cursor = db.execute(
        "UPDATE account_tokens SET consumed_at=? WHERE id=? AND consumed_at IS NULL",
        (int(time.time()), row["id"]),
    )
    if cursor.rowcount != 1:
        return None
    return row


def record_request(db: sqlite3.Connection, fingerprint: str, kind: str) -> bool:
    """Bound request creation without revealing whether an email exists."""
    now = int(time.time())
    row = db.execute(
        "SELECT * FROM recovery_requests WHERE fingerprint=? AND kind=?",
        (fingerprint, kind),
    ).fetchone()
    if not row or now - int(row["window_started_at"]) >= REQUEST_WINDOW_SECONDS:
        db.execute(
            "INSERT INTO recovery_requests(fingerprint,kind,requests,window_started_at,updated_at) "
            "VALUES(?,?,?,?,?) ON CONFLICT(fingerprint,kind) DO UPDATE SET "
            "requests=excluded.requests,window_started_at=excluded.window_started_at,updated_at=excluded.updated_at",
            (fingerprint, kind, 1, now, now),
        )
        return True
    requests = int(row["requests"]) + 1
    db.execute(
        "UPDATE recovery_requests SET requests=?,updated_at=? WHERE fingerprint=? AND kind=?",
        (requests, now, fingerprint, kind),
    )
    return requests <= REQUEST_MAX


def send_email(*, to_email: str, subject: str, text: str) -> bool:
    """Send through owner-controlled SMTP. Disabled/log-only modes never send externally."""
    if MAIL_MODE in {"disabled", "none", "off"}:
        return False
    if MAIL_MODE == "log":
        print(f"IZAKHONO_ID_EMAIL_LOG to={to_email} subject={subject}")
        return True
    if not SMTP_HOST or not SMTP_FROM:
        raise RuntimeError("email_delivery_not_configured")
    msg = EmailMessage()
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.set_content(text)
    with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
        smtp.ehlo()
        if SMTP_STARTTLS:
            smtp.starttls()
            smtp.ehlo()
        if SMTP_USERNAME:
            smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
        smtp.send_message(msg)
    return True


def recovery_message(email: str, token: str) -> tuple[str, str]:
    if not PUBLIC_BASE_URL:
        raise RuntimeError("public_base_url_not_configured")
    link = f"{PUBLIC_BASE_URL}/account-recovery?token={token}"
    subject = "IZAKHONO ID password reset"
    text = (
        "A password reset was requested for your IZAKHONO ID account.\n\n"
        f"Use this link within {TOKEN_SECONDS // 60} minutes:\n{link}\n\n"
        "If you did not request this, ignore this message. The link is single-use.\n"
    )
    return subject, text


def verification_message(email: str, token: str) -> tuple[str, str]:
    if not PUBLIC_BASE_URL:
        raise RuntimeError("public_base_url_not_configured")
    link = f"{PUBLIC_BASE_URL}/verify-email?token={token}"
    subject = "Verify your IZAKHONO ID email"
    text = (
        "Please verify the email address on your IZAKHONO ID account.\n\n"
        f"Use this link within {TOKEN_SECONDS // 60} minutes:\n{link}\n\n"
        "The verification link is single-use. If you did not create this account, ignore this message.\n"
    )
    return subject, text


def migrate(db: sqlite3.Connection) -> None:
    db.execute("""CREATE TABLE IF NOT EXISTS account_tokens(
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      entity_id TEXT,
      kind TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      attempts INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER
    )""")
    db.execute("CREATE INDEX IF NOT EXISTS idx_account_tokens_user_kind ON account_tokens(user_id,kind)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_account_tokens_expiry ON account_tokens(expires_at)")
    db.execute("""CREATE TABLE IF NOT EXISTS recovery_requests(
      fingerprint TEXT NOT NULL,
      kind TEXT NOT NULL,
      requests INTEGER NOT NULL DEFAULT 0,
      window_started_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY(fingerprint,kind)
    )""")
    db.commit()
