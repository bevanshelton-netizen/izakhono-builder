#!/usr/bin/env python3
"""Real external inbound/outbound/reply acceptance for the canonical Stalwart plane.

Credentials must be injected at execution time by FORTRESS. This script sends
three uniquely correlated test messages and never prints credentials.
"""
from __future__ import annotations

import imaplib
import json
import os
import smtplib
import ssl
import time
import uuid
from datetime import datetime, timezone
from email.message import EmailMessage
from email.parser import BytesParser
from email.policy import default
from email.utils import formatdate, make_msgid


def required(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"missing_required_setting:{name}")
    return value


def integer(name: str, default_value: int) -> int:
    raw = os.environ.get(name, str(default_value))
    try:
        value = int(raw)
    except ValueError as exc:
        raise RuntimeError(f"invalid_integer_setting:{name}") from exc
    if value <= 0:
        raise RuntimeError(f"invalid_integer_setting:{name}")
    return value


def send_message(host: str, port: int, tls_mode: str, username: str,
                 password: str, message: EmailMessage) -> None:
    context = ssl.create_default_context()
    if tls_mode == "ssl":
        client = smtplib.SMTP_SSL(host, port, timeout=20, context=context)
    elif tls_mode == "starttls":
        client = smtplib.SMTP(host, port, timeout=20)
        client.ehlo()
        client.starttls(context=context)
        client.ehlo()
    else:
        raise RuntimeError("unsupported_smtp_tls_mode")
    try:
        client.login(username, password)
        refused = client.send_message(message)
        if refused:
            raise RuntimeError("smtp_recipient_rejected")
    finally:
        try:
            client.quit()
        except Exception:
            client.close()


def find_message(host: str, port: int, username: str, password: str,
                 token: str, timeout: int, interval: int) -> EmailMessage:
    context = ssl.create_default_context()
    deadline = time.monotonic() + timeout
    client = imaplib.IMAP4_SSL(host, port, ssl_context=context, timeout=20)
    try:
        client.login(username, password)
        status, _ = client.select("INBOX", readonly=True)
        if status != "OK":
            raise RuntimeError("imap_inbox_unavailable")
        while time.monotonic() < deadline:
            status, data = client.search(None, "TEXT", f'"{token}"')
            if status == "OK" and data and data[0]:
                for message_id in reversed(data[0].split()):
                    status, fetched = client.fetch(message_id, "(RFC822)")
                    if status != "OK":
                        continue
                    raw = next((item[1] for item in fetched if isinstance(item, tuple)), None)
                    if raw:
                        message = BytesParser(policy=default).parsebytes(raw)
                        return message
            time.sleep(interval)
        raise TimeoutError("mail_delivery_timeout")
    finally:
        try:
            client.logout()
        except Exception:
            pass


def make_message(sender: str, recipient: str, subject: str, token: str,
                 message_id: str | None = None) -> EmailMessage:
    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message["Date"] = formatdate(localtime=False, usegmt=True)
    message["Message-ID"] = message_id or make_msgid()
    message.set_content(f"IZAKHONO MAIL external acceptance probe\nCorrelation: {token}\n")
    return message


def observed(check: str, message: EmailMessage) -> dict:
    return {
        "check": check,
        "status": "VERIFIED",
        "message_id": str(message.get("Message-ID", "")),
        "in_reply_to": str(message.get("In-Reply-To", "")),
        "from": str(message.get("From", "")),
        "to": str(message.get("To", "")),
        "subject": str(message.get("Subject", "")),
        "observed_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    test_id = uuid.uuid4().hex
    timeout = integer("MAIL_TEST_TIMEOUT_SECONDS", 120)
    interval = integer("MAIL_TEST_POLL_INTERVAL_SECONDS", 5)

    iz_smtp_host = required("IZAKHONO_MAIL_SMTP_HOST")
    iz_smtp_port = integer("IZAKHONO_MAIL_SMTP_PORT", 465)
    iz_smtp_mode = os.environ.get("IZAKHONO_MAIL_SMTP_TLS_MODE", "ssl").lower()
    iz_smtp_user = required("IZAKHONO_MAIL_SMTP_USER")
    iz_smtp_pass = required("IZAKHONO_MAIL_SMTP_PASS")
    iz_from = os.environ.get("IZAKHONO_MAIL_FROM", iz_smtp_user).strip()
    iz_imap_host = os.environ.get("IZAKHONO_MAIL_IMAP_HOST", iz_smtp_host).strip()
    iz_imap_port = integer("IZAKHONO_MAIL_IMAP_PORT", 993)
    iz_imap_user = os.environ.get("IZAKHONO_MAIL_IMAP_USER", iz_smtp_user).strip()
    iz_imap_pass = os.environ.get("IZAKHONO_MAIL_IMAP_PASS", iz_smtp_pass)

    ext_smtp_host = required("EXTERNAL_SMTP_HOST")
    ext_smtp_port = integer("EXTERNAL_SMTP_PORT", 587)
    ext_smtp_mode = os.environ.get("EXTERNAL_SMTP_TLS_MODE", "starttls").lower()
    ext_smtp_user = required("EXTERNAL_SMTP_USER")
    ext_smtp_pass = required("EXTERNAL_SMTP_PASS")
    ext_from = os.environ.get("EXTERNAL_EMAIL", ext_smtp_user).strip()
    ext_imap_host = required("EXTERNAL_IMAP_HOST")
    ext_imap_port = integer("EXTERNAL_IMAP_PORT", 993)
    ext_imap_user = os.environ.get("EXTERNAL_IMAP_USER", ext_smtp_user).strip()
    ext_imap_pass = os.environ.get("EXTERNAL_IMAP_PASS", ext_smtp_pass)

    checks: list[dict] = []
    stage = "external-inbound"
    try:
        inbound_token = f"IZAKHONO-INBOUND-{test_id}"
        inbound = make_message(ext_from, iz_from, f"IZAKHONO inbound {test_id}", inbound_token)
        send_message(ext_smtp_host, ext_smtp_port, ext_smtp_mode, ext_smtp_user, ext_smtp_pass, inbound)
        received_inbound = find_message(iz_imap_host, iz_imap_port, iz_imap_user, iz_imap_pass,
                                        inbound_token, timeout, interval)
        checks.append(observed("external-inbound", received_inbound))

        stage = "external-outbound"
        outbound_token = f"IZAKHONO-OUTBOUND-{test_id}"
        outbound_id = make_msgid(domain=iz_from.rsplit("@", 1)[-1])
        outbound = make_message(iz_from, ext_from, f"IZAKHONO outbound {test_id}",
                                outbound_token, outbound_id)
        send_message(iz_smtp_host, iz_smtp_port, iz_smtp_mode, iz_smtp_user, iz_smtp_pass, outbound)
        received_outbound = find_message(ext_imap_host, ext_imap_port, ext_imap_user, ext_imap_pass,
                                          outbound_token, timeout, interval)
        checks.append(observed("external-outbound", received_outbound))

        stage = "external-reply"
        reply_token = f"IZAKHONO-REPLY-{test_id}"
        reply = make_message(ext_from, iz_from, f"Re: IZAKHONO outbound {test_id}", reply_token)
        reply["In-Reply-To"] = outbound_id
        reply["References"] = outbound_id
        send_message(ext_smtp_host, ext_smtp_port, ext_smtp_mode, ext_smtp_user, ext_smtp_pass, reply)
        received_reply = find_message(iz_imap_host, iz_imap_port, iz_imap_user, iz_imap_pass,
                                      reply_token, timeout, interval)
        if received_reply.get("In-Reply-To") != outbound_id:
            raise RuntimeError("reply_thread_mismatch")
        checks.append(observed("external-reply", received_reply))

        print(json.dumps({
            "schema_version": 1,
            "receipt_id": f"mail_accept_{test_id}",
            "status": "VERIFIED",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
        }, sort_keys=True))
    except Exception as error:
        print(json.dumps({
            "schema_version": 1,
            "receipt_id": f"mail_accept_{test_id}",
            "status": "FAILED",
            "failed_stage": stage,
            "error_code": type(error).__name__,
            "completed_at": datetime.now(timezone.utc).isoformat(),
            "checks": checks,
        }, sort_keys=True))
        raise SystemExit(2)


if __name__ == "__main__":
    main()
