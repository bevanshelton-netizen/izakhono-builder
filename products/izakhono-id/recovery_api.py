#!/usr/bin/env python3
"""HTTP recovery boundary for IZAKHONO ID.

This service deliberately issues no authenticated session. Password recovery
only changes the password; the customer must subsequently use the normal login
flow, including TOTP/recovery-code MFA when enrolled.
"""
from __future__ import annotations

import hashlib
import html
import json
import os
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import account_recovery
import app

HOST = os.getenv("IZAKHONO_ID_RECOVERY_HOST", "127.0.0.1")
PORT = int(os.getenv("IZAKHONO_ID_RECOVERY_PORT", "9697"))
ALLOWED_ORIGIN = os.getenv("IZAKHONO_ID_RECOVERY_ALLOWED_ORIGIN", "").rstrip("/")
MAX_BODY = 50_000
UNIFORM_RESPONSE = {"ok": True, "message": "If the account can receive this message, instructions have been sent."}


def fingerprint(handler: BaseHTTPRequestHandler, kind: str, email: str) -> str:
    ip = handler.client_address[0] if handler.client_address else ""
    return hashlib.sha256(f"{kind}|{str(email).strip().lower()}|{ip}".encode()).hexdigest()


def send_json(handler: BaseHTTPRequestHandler, status: int, body: dict):
    raw = json.dumps(body, separators=(",", ":")).encode()
    handler.send_response(status)
    handler.send_header("content-type", "application/json; charset=utf-8")
    handler.send_header("content-length", str(len(raw)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("pragma", "no-cache")
    handler.send_header("x-content-type-options", "nosniff")
    handler.send_header("referrer-policy", "no-referrer")
    origin = handler.headers.get("origin", "")
    if ALLOWED_ORIGIN and origin == ALLOWED_ORIGIN:
        handler.send_header("access-control-allow-origin", ALLOWED_ORIGIN)
        handler.send_header("access-control-allow-methods", "POST, OPTIONS")
        handler.send_header("access-control-allow-headers", "content-type")
        handler.send_header("vary", "Origin")
    handler.end_headers()
    handler.wfile.write(raw)


def send_html(handler: BaseHTTPRequestHandler, body: str):
    raw = body.encode()
    handler.send_response(200)
    handler.send_header("content-type", "text/html; charset=utf-8")
    handler.send_header("content-length", str(len(raw)))
    handler.send_header("cache-control", "no-store")
    handler.send_header("x-content-type-options", "nosniff")
    handler.send_header("referrer-policy", "no-referrer")
    handler.end_headers()
    handler.wfile.write(raw)


def read_json(handler: BaseHTTPRequestHandler):
    size = int(handler.headers.get("content-length", "0") or "0")
    if size <= 0 or size > MAX_BODY:
        raise ValueError("invalid_body_size")
    return json.loads(handler.rfile.read(size).decode())


def page(title: str, heading: str, form_html: str) -> str:
    return f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>{html.escape(title)}</title><style>body{{font-family:system-ui,-apple-system,sans-serif;background:#f5f7fa;margin:0;color:#16202a}}main{{max-width:520px;margin:8vh auto;padding:28px;background:white;border-radius:16px;box-shadow:0 10px 40px #0001}}h1{{margin-top:0}}input,button{{box-sizing:border-box;width:100%;padding:13px;margin:7px 0;border:1px solid #ccd3da;border-radius:9px;font:inherit}}button{{background:#111;color:#fff;border:0;cursor:pointer}}.note{{color:#59636e;font-size:.94rem}}#status{{margin-top:14px;min-height:24px}}</style></head><body><main><h1>{html.escape(heading)}</h1>{form_html}<p id="status" class="note"></p></main></body></html>'''


def issue_mail(db: sqlite3.Connection, user, kind: str) -> bool:
    token = account_recovery.issue_token(db, user["id"], kind)
    if kind == "password_reset":
        subject, text = account_recovery.recovery_message(user["email"], token)
    else:
        subject, text = account_recovery.verification_message(user["email"], token)
    return account_recovery.send_email(to_email=user["email"], subject=subject, text=text)


class Handler(BaseHTTPRequestHandler):
    server_version = "IzakhonoIDRecovery/1.2"

    def log_message(self, fmt, *args):
        print(f"{self.client_address[0]} - {fmt % args}")

    def do_OPTIONS(self):
        if ALLOWED_ORIGIN and self.headers.get("origin", "") == ALLOWED_ORIGIN:
            self.send_response(204)
            self.send_header("access-control-allow-origin", ALLOWED_ORIGIN)
            self.send_header("access-control-allow-methods", "POST, OPTIONS")
            self.send_header("access-control-allow-headers", "content-type")
            self.send_header("access-control-max-age", "600")
            self.send_header("vary", "Origin")
            self.end_headers()
            return
        send_json(self, 204, {})

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        if path == "/healthz":
            return send_json(self, 200, {"ok": True, "service": "izakhono-id-recovery", "token_lifetime_seconds": account_recovery.TOKEN_SECONDS, "email_mode": account_recovery.MAIL_MODE, "mfa_bypass": False, "authenticated_session_issued_by_recovery": False})
        if path == "/forgot-password":
            return send_html(self, page("IZAKHONO ID Password Recovery", "Forgot your password?", '''<p class="note">Enter your IZAKHONO ID email. For privacy, the response is the same whether an account exists or not.</p><input id="email" type="email" autocomplete="email" placeholder="Email address"><button id="submit">Send reset instructions</button><script>document.querySelector('#submit').onclick=async()=>{const email=document.querySelector('#email').value.trim(),s=document.querySelector('#status');if(!email){s.textContent='Enter your email address.';return}const r=await fetch('/api/v1/recovery/request',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email})});const d=await r.json();s.textContent=d.message||'If the account can receive this message, instructions have been sent.';};</script>'''))
        token = parsed.query.split("token=", 1)[1].split("&", 1)[0] if "token=" in parsed.query else ""
        if path == "/account-recovery":
            return send_html(self, page("IZAKHONO ID Password Recovery", "Reset your IZAKHONO ID password", f'''<p class="note">Choose a new password. The link is single-use and expires automatically.</p><input id="password" type="password" autocomplete="new-password" minlength="12" placeholder="New password (12+ characters)"><input id="confirm" type="password" autocomplete="new-password" minlength="12" placeholder="Confirm new password"><button id="submit">Reset password</button><script>const token={json.dumps(token)};document.querySelector('#submit').onclick=async()=>{{const a=document.querySelector('#password').value,b=document.querySelector('#confirm').value,s=document.querySelector('#status');if(a.length<12||a!==b){{s.textContent='Passwords must match and contain at least 12 characters.';return}}const r=await fetch('/api/v1/recovery/reset',{{method:'POST',headers:{{'content-type':'application/json'}},body:JSON.stringify({{token,new_password:a}})}});const d=await r.json();s.textContent=d.message||d.error||(r.ok?'Password reset complete. Sign in again.':'Password reset failed.');document.querySelector('#password').value='';document.querySelector('#confirm').value='';}};</script>'''))
        if path == "/verify-email":
            return send_html(self, page("IZAKHONO ID Email Verification", "Verify your IZAKHONO ID email", f'''<p class="note">Confirming your email address…</p><script>const token={json.dumps(token)};const s=document.querySelector('#status');(async()=>{{const r=await fetch('/api/v1/email/verification/confirm',{{method:'POST',headers:{{'content-type':'application/json'}},body:JSON.stringify({{token}})}});const d=await r.json();s.textContent=d.email_verified?'Email verified. You can now sign in.':(d.error||'Verification failed.');}})();</script>'''))
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/v1/recovery/request": return self.recovery_request()
        if path == "/api/v1/recovery/reset": return self.recovery_reset()
        if path == "/api/v1/email/verification/request": return self.verification_request()
        if path == "/api/v1/email/verification/confirm": return self.verification_confirm()
        return send_json(self, 404, {"ok": False, "error": "not_found"})

    def recovery_request(self):
        try:
            data = read_json(self); email = app.clean_email(data.get("email"))
        except (ValueError, json.JSONDecodeError): return send_json(self, 202, UNIFORM_RESPONSE)
        with app.db_connect() as db:
            allowed = account_recovery.record_request(db, fingerprint(self, "password_reset", email), "password_reset")
            user = db.execute("SELECT * FROM users WHERE email=? AND status='active'", (email,)).fetchone()
            if allowed and user and user["email_verified_at"]:
                try:
                    sent = issue_mail(db, user, "password_reset")
                    app.audit(db, "password.recovery_requested", user_id=user["id"], subject=email, detail=f"delivery={'sent' if sent else 'not_sent'}")
                except Exception as exc:
                    app.audit(db, "password.recovery_delivery_failed", user_id=user["id"], subject=email, detail=str(exc)[:160])
            else:
                app.audit(db, "password.recovery_requested", user_id=user["id"] if user else None, subject=email, detail="uniform_response")
            db.commit()
        return send_json(self, 202, UNIFORM_RESPONSE)

    def recovery_reset(self):
        try:
            data = read_json(self); token = str(data.get("token") or "").strip(); new_password = str(data.get("new_password") or "")
            if not token: raise ValueError("recovery_token_required")
            salt, digest = app.hash_password(new_password)
        except (ValueError, json.JSONDecodeError) as exc: return send_json(self, 422, {"ok": False, "error": str(exc)})
        with app.db_connect() as db:
            row = account_recovery.consume_token(db, token, "password_reset")
            if not row: return send_json(self, 401, {"ok": False, "error": "invalid_or_expired_recovery_token"})
            user = db.execute("SELECT * FROM users WHERE id=? AND status='active'", (row["user_id"],)).fetchone()
            if not user or not user["email_verified_at"]: return send_json(self, 401, {"ok": False, "error": "invalid_or_expired_recovery_token"})
            ts = app.now_iso()
            db.execute("UPDATE users SET password_salt=?,password_hash=?,updated_at=? WHERE id=?", (salt, digest, ts, user["id"]))
            db.execute("UPDATE sessions SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL", (ts, user["id"]))
            db.execute("UPDATE login_challenges SET consumed_at=? WHERE user_id=? AND consumed_at IS NULL", (ts, user["id"]))
            app.audit(db, "password.recovered", user_id=user["id"], subject=user["email"], detail=f"mfa_enabled={bool(user['mfa_enabled_at'])};session_issued=false")
            db.commit()
        return send_json(self, 200, {"ok": True, "password_reset": True, "sessions_revoked": True, "mfa_required_on_next_login": bool(user["mfa_enabled_at"]), "message": "Password reset complete. Sign in again; multi-factor authentication remains required when enabled."})

    def verification_request(self):
        try:
            data = read_json(self); email = app.clean_email(data.get("email"))
        except (ValueError, json.JSONDecodeError): return send_json(self, 202, UNIFORM_RESPONSE)
        with app.db_connect() as db:
            allowed = account_recovery.record_request(db, fingerprint(self, "email_verification", email), "email_verification")
            user = db.execute("SELECT * FROM users WHERE email=? AND status='active'", (email,)).fetchone()
            if allowed and user and not user["email_verified_at"]:
                try:
                    sent = issue_mail(db, user, "email_verification")
                    app.audit(db, "email.verification_requested", user_id=user["id"], subject=email, detail=f"delivery={'sent' if sent else 'not_sent'}")
                except Exception as exc:
                    app.audit(db, "email.verification_delivery_failed", user_id=user["id"], subject=email, detail=str(exc)[:160])
            else:
                app.audit(db, "email.verification_requested", user_id=user["id"] if user else None, subject=email, detail="uniform_response")
            db.commit()
        return send_json(self, 202, UNIFORM_RESPONSE)

    def verification_confirm(self):
        try:
            data = read_json(self); token = str(data.get("token") or "").strip()
            if not token: raise ValueError("verification_token_required")
        except (ValueError, json.JSONDecodeError) as exc: return send_json(self, 422, {"ok": False, "error": str(exc)})
        with app.db_connect() as db:
            row = account_recovery.consume_token(db, token, "email_verification")
            if not row: return send_json(self, 401, {"ok": False, "error": "invalid_or_expired_verification_token"})
            user = db.execute("SELECT * FROM users WHERE id=? AND status='active'", (row["user_id"],)).fetchone()
            if not user: return send_json(self, 401, {"ok": False, "error": "invalid_or_expired_verification_token"})
            ts = app.now_iso(); db.execute("UPDATE users SET email_verified_at=?,updated_at=? WHERE id=?", (ts, ts, user["id"]))
            app.audit(db, "email.verified", user_id=user["id"], subject=user["email"]); db.commit()
        return send_json(self, 200, {"ok": True, "email_verified": True})


def main():
    with app.db_connect() as db: account_recovery.migrate(db)
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"IZAKHONO ID recovery listening on {HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__": main()
