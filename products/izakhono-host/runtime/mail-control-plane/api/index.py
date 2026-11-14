import hashlib
import os
import secrets
import sqlite3
import time
import socket
import ssl
from datetime import datetime, timezone
from contextlib import closing
from pathlib import Path
import re
from typing import Any

import httpx
import dns.resolver
import dns.exception
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel, Field, field_validator
from cryptography.fernet import Fernet, InvalidToken

app = FastAPI(title="IZAKHONO Mail Control Plane", version="1.3.0")

JMAP_CAPS = ["urn:ietf:params:jmap:core", "urn:stalwart:jmap"]


def require_control_plane_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("CONTROL_PLANE_TOKEN")
    if not expected:
        raise HTTPException(503, "Control plane is not configured")
    if authorization != f"Bearer {expected}":
        raise HTTPException(401, "Unauthorized")


def jmap_url() -> str:
    base = os.getenv("STALWART_API_URL", "").rstrip("/")
    if not base:
        raise HTTPException(503, "STALWART_API_URL is not configured")
    return f"{base}/jmap/"


def stalwart_headers() -> dict[str, str]:
    token = os.getenv("STALWART_API_KEY")
    if not token:
        raise HTTPException(503, "STALWART_API_KEY is not configured")
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


async def jmap(method_calls: list[list[Any]]) -> dict[str, Any]:
    payload = {"using": JMAP_CAPS, "methodCalls": method_calls}
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.post(jmap_url(), headers=stalwart_headers(), json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Mail server unavailable: {exc.__class__.__name__}") from exc
    if response.status_code >= 400:
        raise HTTPException(502, "Mail server rejected the management request")
    try:
        data = response.json()
    except ValueError as exc:
        raise HTTPException(502, "Mail server returned invalid JSON") from exc
    if any(call and call[0] == "error" for call in data.get("methodResponses", [])):
        raise HTTPException(502, "Mail server returned a management error")
    return data


def method_result(data: dict[str, Any], operation: str) -> dict[str, Any]:
    responses = data.get("methodResponses", [])
    if not responses or not isinstance(responses[0], list) or len(responses[0]) < 2:
        raise HTTPException(502, f"Mail server returned an incomplete {operation} response")
    if responses[0][0] == "error":
        raise HTTPException(502, f"Mail server rejected {operation}")
    result = responses[0][1]
    if not isinstance(result, dict):
        raise HTTPException(502, f"Mail server returned an invalid {operation} response")
    return result


class PasswordChange(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    current_password: str = Field(min_length=1, max_length=1024)
    new_password: str = Field(min_length=12, max_length=1024)


HANDOVER_TTL_SECONDS = 15 * 60
ACTIVATION_TTL_SECONDS = 24 * 60 * 60


class HandoverRetrieve(BaseModel):
    handover_token: str = Field(min_length=32, max_length=128)


class MailboxActivate(BaseModel):
    activation_token: str = Field(min_length=32, max_length=128)
    new_password: str = Field(min_length=12, max_length=1024)


def handover_cipher() -> Fernet:
    key = os.getenv("MAIL_HANDOVER_ENCRYPTION_KEY")
    if not key:
        raise HTTPException(503, "Secure mailbox handover is not configured")
    try:
        return Fernet(key.encode("ascii"))
    except (ValueError, UnicodeEncodeError) as exc:
        raise HTTPException(503, "Secure mailbox handover is not configured") from exc


def handover_db() -> sqlite3.Connection:
    path = Path(os.getenv("MAIL_HANDOVER_DB", "/var/lib/izakhono-mail/handover.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5, isolation_level=None)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS mailbox_handovers (
            token_hash TEXT PRIMARY KEY,
            address TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            encrypted_activation_token TEXT NOT NULL
        )
    """)
    columns = {row[1] for row in connection.execute("PRAGMA table_info(mailbox_handovers)")}
    if "encrypted_password" in columns:
        # Remove the obsolete encrypted temporary-password field.
        connection.execute("DROP TABLE IF EXISTS mailbox_handovers_new")
        connection.execute("""
            CREATE TABLE mailbox_handovers_new (
                token_hash TEXT PRIMARY KEY,
                address TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                encrypted_activation_token TEXT NOT NULL
            )
        """)
        if "encrypted_activation_token" in columns:
            connection.execute("""
                INSERT INTO mailbox_handovers_new(token_hash,address,expires_at,encrypted_activation_token)
                SELECT token_hash,address,expires_at,encrypted_activation_token
                FROM mailbox_handovers WHERE encrypted_activation_token IS NOT NULL
            """)
        connection.execute("DROP TABLE mailbox_handovers")
        connection.execute("ALTER TABLE mailbox_handovers_new RENAME TO mailbox_handovers")
    elif "encrypted_activation_token" not in columns:
        connection.execute("ALTER TABLE mailbox_handovers ADD COLUMN encrypted_activation_token TEXT")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS mailbox_activations (
            token_hash TEXT PRIMARY KEY,
            address TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        )
    """)
    now = int(time.time())
    connection.execute("DELETE FROM mailbox_handovers WHERE expires_at < ?", (now,))
    connection.execute("DELETE FROM mailbox_activations WHERE expires_at < ?", (now,))
    return connection


def store_handover(address: str) -> str:
    cipher = handover_cipher()
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    activation_token = secrets.token_urlsafe(32)
    activation_hash = hashlib.sha256(activation_token.encode("utf-8")).hexdigest()
    encrypted_activation = cipher.encrypt(activation_token.encode("utf-8")).decode("ascii")
    now = int(time.time())
    try:
        with closing(handover_db()) as connection:
            connection.execute("BEGIN IMMEDIATE")
            connection.execute(
                "INSERT INTO mailbox_handovers(token_hash,address,expires_at,encrypted_activation_token) VALUES(?,?,?,?)",
                (token_hash, address, now + HANDOVER_TTL_SECONDS, encrypted_activation),
            )
            connection.execute(
                "INSERT INTO mailbox_activations(token_hash,address,expires_at) VALUES(?,?,?)",
                (activation_hash, address, now + ACTIVATION_TTL_SECONDS),
            )
            connection.commit()
    except sqlite3.Error as exc:
        raise HTTPException(503, "Secure mailbox handover storage is unavailable") from exc
    return token


def discard_handover(token: str) -> None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    try:
        with closing(handover_db()) as connection:
            row = connection.execute(
                "SELECT encrypted_activation_token FROM mailbox_handovers WHERE token_hash=?",
                (token_hash,),
            ).fetchone()
            connection.execute("DELETE FROM mailbox_handovers WHERE token_hash=?", (token_hash,))
            if row and row[0]:
                activation = handover_cipher().decrypt(row[0].encode("ascii")).decode("utf-8")
                activation_hash = hashlib.sha256(activation.encode("utf-8")).hexdigest()
                connection.execute("DELETE FROM mailbox_activations WHERE token_hash=?", (activation_hash,))
    except (sqlite3.Error, InvalidToken, UnicodeError, ValueError) as exc:
        raise HTTPException(503, "Secure mailbox handover storage is unavailable") from exc


def consume_handover(token: str) -> dict[str, str] | None:
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    connection = handover_db()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT address, expires_at, encrypted_activation_token FROM mailbox_handovers WHERE token_hash=?",
            (token_hash,),
        ).fetchone()
        if not row:
            connection.commit()
            return None
        if not row[2]:
            raise HTTPException(503, "Secure mailbox handover could not be completed")
        try:
            activation_token = handover_cipher().decrypt(row[2].encode("ascii")).decode("utf-8")
        except (InvalidToken, UnicodeError, ValueError) as exc:
            raise HTTPException(503, "Secure mailbox handover could not be completed") from exc
        activation_hash = hashlib.sha256(activation_token.encode("utf-8")).hexdigest()
        if row[1] < int(time.time()):
            connection.execute("DELETE FROM mailbox_activations WHERE token_hash=?", (activation_hash,))
            connection.execute("DELETE FROM mailbox_handovers WHERE token_hash=?", (token_hash,))
            connection.commit()
            return None
        connection.execute("DELETE FROM mailbox_handovers WHERE token_hash=?", (token_hash,))
        connection.commit()
        return {"address": row[0], "activation_token": activation_token, "activation_expires_in_seconds": ACTIVATION_TTL_SECONDS}
    except HTTPException:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise HTTPException(503, "Secure mailbox handover storage is unavailable") from exc
    finally:
        connection.close()



async def activate_mailbox_with_token(token: str, new_password: str) -> dict[str, str]:
    if not any(char.islower() for char in new_password) or not any(char.isupper() for char in new_password) or not any(char.isdigit() for char in new_password):
        raise HTTPException(400, "New password must include upper-case, lower-case and numeric characters")

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    connection = handover_db()
    try:
        connection.execute("BEGIN IMMEDIATE")
        row = connection.execute(
            "SELECT address, expires_at FROM mailbox_activations WHERE token_hash=?",
            (token_hash,),
        ).fetchone()
        if not row:
            connection.commit()
            raise HTTPException(410, "Activation token is invalid or already used")
        if row[1] < int(time.time()):
            connection.execute("DELETE FROM mailbox_activations WHERE token_hash=?", (token_hash,))
            connection.commit()
            raise HTTPException(410, "Activation token has expired")

        address = row[0]
        local_part, domain = address.rsplit("@", 1)
        domain_data = await jmap([
            ["x:Domain/query", {"filter": {"name": domain}}, "activation-domain-query"]
        ])
        domain_ids = method_result(domain_data, "activation domain query").get("ids", [])
        if not domain_ids:
            raise HTTPException(503, "Mailbox activation is pending administrator review")
        account_data = await jmap([
            ["x:Account/query", {"filter": {"name": local_part, "domainId": domain_ids[0]}}, "activation-account-query"]
        ])
        account_ids = method_result(account_data, "activation account query").get("ids", [])
        if not account_ids:
            raise HTTPException(503, "Mailbox activation is pending administrator review")
        update_data = await jmap([
            ["x:Account/set", {
                "update": {
                    account_ids[0]: {
                        "credentials/0/secret": new_password,
                        "permissions": {"@type": "Inherit"},
                    }
                }
            }, "activate-mailbox"]
        ])
        result = method_result(update_data, "mailbox activation")
        if result.get("notUpdated"):
            raise HTTPException(503, "Mailbox activation could not be completed")
        connection.execute("DELETE FROM mailbox_activations WHERE token_hash=?", (token_hash,))
        connection.commit()
    except HTTPException:
        connection.rollback()
        raise
    except sqlite3.Error as exc:
        connection.rollback()
        raise HTTPException(503, "Secure mailbox activation storage is unavailable") from exc
    finally:
        connection.close()
    return {"status": "activated", "address": address, "message": "Your mailbox password is set and outgoing mail is now activated."}



DOMAIN_PATTERN = re.compile(
    r"^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)(?:\.(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?))+$"
)
LOCAL_PART_PATTERN = re.compile(r"^[A-Za-z0-9_+-](?:[A-Za-z0-9._+-]*[A-Za-z0-9_+-])?$")


class DomainCreate(BaseModel):
    domain: str

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not DOMAIN_PATTERN.fullmatch(normalized):
            raise ValueError("Invalid domain name")
        return normalized


class MailboxCreate(BaseModel):
    domain: str
    local_part: str
    display_name: str = Field(default="", max_length=120)

    @field_validator("domain")
    @classmethod
    def normalize_domain(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not DOMAIN_PATTERN.fullmatch(normalized):
            raise ValueError("Invalid domain name")
        return normalized

    @field_validator("local_part")
    @classmethod
    def normalize_local_part(cls, value: str) -> str:
        normalized = value.strip().lower()
        if len(normalized) > 64 or not LOCAL_PART_PATTERN.fullmatch(normalized) or ".." in normalized:
            raise ValueError("Invalid mailbox local part")
        return normalized



DOMAIN_VERIFICATION_TTL_SECONDS = int(os.getenv("MAIL_DOMAIN_VERIFICATION_TTL_SECONDS", "604800"))


def require_allowed_domain(domain: str) -> None:
    allowed = {
        item.strip().lower()
        for item in os.getenv("MAIL_ALLOWED_DOMAINS", "").split(",")
        if item.strip()
    }
    if not allowed or domain.lower() not in allowed:
        raise HTTPException(403, "Domain is not approved for IZAKHONO mail provisioning")


def domain_verification_db() -> sqlite3.Connection:
    path = Path(os.getenv("MAIL_HANDOVER_DB", "/var/lib/izakhono-mail/handover.sqlite3"))
    path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(path, timeout=5, isolation_level=None)
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("""
        CREATE TABLE IF NOT EXISTS domain_verifications (
            domain TEXT PRIMARY KEY,
            token_hash TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            verified_at INTEGER
        )
    """)
    return connection


def require_verified_domain(domain: str) -> None:
    require_allowed_domain(domain)
    connection = domain_verification_db()
    try:
        row = connection.execute(
            "SELECT verified_at, expires_at FROM domain_verifications WHERE domain=?",
            (domain.lower(),),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        raise HTTPException(409, "Domain ownership has not been verified")
    if row[0]:
        return
    if int(row[1]) < int(time.time()):
        raise HTTPException(410, "Domain verification has expired")
    raise HTTPException(409, "Domain ownership has not been verified")


def dns_txt_values(name: str) -> list[str] | None:
    try:
        answers = dns.resolver.resolve(name, "TXT", lifetime=3)
        return [
            b"".join(record.strings).decode("utf-8", "ignore")
            for record in answers
        ]
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return []
    except (dns.exception.Timeout, dns.resolver.NoNameservers):
        return None
    except Exception:
        return None


def dns_check_txt(name: str, prefix: str) -> str:
    values = dns_txt_values(name)
    if values is None:
        return "pending"
    if any(value.startswith(prefix) for value in values):
        return "passed"
    return "failed"


def dns_check_mx(domain: str, expected_host: str) -> str:
    try:
        answers = dns.resolver.resolve(domain, "MX", lifetime=3)
        targets = {str(record.exchange).rstrip(".").lower() for record in answers}
        return "passed" if expected_host.lower().rstrip(".") in targets else "failed"
    except (dns.resolver.NXDOMAIN, dns.resolver.NoAnswer):
        return "failed"
    except (dns.exception.Timeout, dns.resolver.NoNameservers):
        return "pending"
    except Exception:
        return "pending"


def tcp_check(host: str, port: int) -> str:
    try:
        with socket.create_connection((host, port), timeout=3):
            return "passed"
    except OSError:
        return "failed"


def tls_check(host: str, port: int) -> str:
    try:
        context = ssl.create_default_context()
        with socket.create_connection((host, port), timeout=4) as raw:
            with context.wrap_socket(raw, server_hostname=host) as secure:
                return "passed" if secure.version() else "failed"
    except (OSError, ssl.SSLError):
        return "failed"


def domain_verified_at(domain: str) -> int | None:
    connection = domain_verification_db()
    try:
        row = connection.execute(
            "SELECT verified_at FROM domain_verifications WHERE domain=?",
            (domain.lower(),),
        ).fetchone()
        return int(row[0]) if row and row[0] else None
    finally:
        connection.close()


async def mta_sts_policy_check(domain: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=5, follow_redirects=True) as client:
            response = await client.get(
                f"https://mta-sts.{domain}/.well-known/mta-sts.txt"
            )
        return "passed" if response.status_code == 200 and "version: STSv1" in response.text else "failed"
    except httpx.HTTPError:
        return "pending"


async def domain_operational_checks(domain: str) -> dict[str, str]:
    mail_host = os.getenv("MAIL_HOST", f"mail.{domain}").strip().lower()
    public_ip = os.getenv("MAIL_PUBLIC_IP", "").strip()
    selector = os.getenv("DKIM_SELECTOR", "").strip()

    spf_values = dns_txt_values(domain)
    if spf_values is None:
        spf_status = "pending"
    else:
        spf_record = next((value for value in spf_values if value.startswith("v=spf1")), "")
        if not spf_record:
            spf_status = "failed"
        elif not public_ip or public_ip.startswith("REPLACE_"):
            spf_status = "pending"
        else:
            spf_status = "passed" if f"ip4:{public_ip}" in spf_record or re.search(r"(^|\\s)mx(\\s|$)", spf_record) else "failed"

    if not selector or selector.startswith("REPLACE_"):
        dkim_status = "pending"
    else:
        dkim_status = dns_check_txt(f"{selector}._domainkey.{domain}", "v=DKIM1")

    return {
        "ownership": "passed" if domain_verified_at(domain) else "pending",
        "mx": dns_check_mx(domain, mail_host),
        "spf": spf_status,
        "dkim": dkim_status,
        "dmarc": dns_check_txt(f"_dmarc.{domain}", "v=DMARC1"),
        "mtaSts": dns_check_txt(f"_mta-sts.{domain}", "v=STSv1"),
        "mtaStsPolicy": await mta_sts_policy_check(domain),
        "tlsRpt": dns_check_txt(f"_smtp._tls.{domain}", "v=TLSRPTv1"),
        "smtp": tcp_check(mail_host, 25),
        "submissionTls": tls_check(mail_host, 465),
        "imapTls": tls_check(mail_host, 993),
        "backup": "pending",
        "fortress": "pending",
        "monitoring": "pending",
    }


@app.get("/api/control-centre", dependencies=[Depends(require_control_plane_token)])
async def control_centre() -> dict[str, Any]:
    domain_query = method_result(
        await jmap([["x:Domain/query", {"filter": {}}, "control-domain-query"]]),
        "control-centre domain query",
    )
    domain_ids = domain_query.get("ids", [])
    domain_objects: list[dict[str, Any]] = []
    if domain_ids:
        domain_get = method_result(
            await jmap([["x:Domain/get", {"ids": domain_ids}, "control-domain-get"]]),
            "control-centre domain get",
        )
        domain_objects = domain_get.get("list", [])

    account_query = method_result(
        await jmap([["x:Account/query", {"filter": {}}, "control-account-query"]]),
        "control-centre account query",
    )
    account_ids = account_query.get("ids", [])
    account_objects: list[dict[str, Any]] = []
    if account_ids:
        account_get = method_result(
            await jmap([["x:Account/get", {"ids": account_ids}, "control-account-get"]]),
            "control-centre account get",
        )
        account_objects = account_get.get("list", [])

    domain_by_id = {
        str(item.get("id")): str(item.get("name", "")).lower()
        for item in domain_objects
        if item.get("id") and item.get("name")
    }
    domains: list[dict[str, Any]] = []
    for item in domain_objects:
        domain = str(item.get("name", "")).lower()
        if not domain:
            continue
        checks = await domain_operational_checks(domain)
        verified_at = domain_verified_at(domain)
        check_values = list(checks.values())
        status = "verified" if verified_at and all(value == "passed" for value in check_values) else (
            "degraded" if verified_at and any(value == "failed" for value in check_values) else "configured"
        )
        domains.append({
            "domain": domain,
            "platform": "IZAKHONO AFRICA" if domain == "izakhonoafrica.co.za" else "Managed domain",
            "status": status,
            "transport": "owned",
            "openIncidents": 0,
            "lastVerifiedAt": datetime.fromtimestamp(verified_at, timezone.utc).isoformat() if verified_at else None,
            "checks": checks,
        })

    mailboxes: list[dict[str, Any]] = []
    for account in account_objects:
        domain = domain_by_id.get(str(account.get("domainId")), "")
        name = str(account.get("name", "")).strip()
        address = str(account.get("email") or (f"{name}@{domain}" if name and domain else name))
        if not address:
            continue
        enabled = account.get("enabled") is not False
        can_send = account.get("emailSend") is True
        status = "suspended" if not enabled else ("active" if can_send else "pending")
        mailboxes.append({
            "address": address,
            "platform": "IZAKHONO AFRICA" if domain == "izakhonoafrica.co.za" else "Managed domain",
            "status": status,
            "storageUsedBytes": int(account.get("usedQuota", 0) or 0),
            "lastAuthenticationAt": None,
            "lastDeliveryAt": None,
            "deliveryFailures": 0,
            "securityStatus": "clear" if enabled else "attention",
            "backupStatus": "pending",
        })

    verified_count = sum(1 for domain in domains if domain["status"] == "verified")
    attention_count = sum(1 for domain in domains if domain["status"] == "degraded")
    active_count = sum(1 for mailbox in mailboxes if mailbox["status"] == "active")
    suspended_count = sum(1 for mailbox in mailboxes if mailbox["status"] == "suspended")
    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "domains": domains,
        "mailboxes": mailboxes,
        "incidents": [],
        "summary": {
            "managedDomains": len(domains),
            "verifiedDomains": verified_count,
            "attentionDomains": attention_count,
            "totalMailboxes": len(mailboxes),
            "activeMailboxes": active_count,
            "suspendedMailboxes": suspended_count,
            "openSecurityAlerts": 0,
        },
    }


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"service": "izakhono-mail-control-plane", "status": "ok"}


@app.get("/api/ready")
async def ready() -> dict[str, str]:
    # A successful authenticated, read-only JMAP query proves that Stalwart
    # is reachable and that the configured management credential is accepted.
    try:
        data = await jmap([["x:Domain/query", {"filter": {}}, "readiness"]])
        method_result(data, "readiness query")
    except Exception as exc:
        # Keep internal URLs, credentials, and backend error details out of
        # the public readiness response.
        raise HTTPException(503, "Mail backend is not ready") from exc
    return {"service": "izakhono-mail-control-plane", "status": "ready", "backend": "stalwart"}


@app.get("/api/domains", dependencies=[Depends(require_control_plane_token)])
async def domains() -> dict[str, Any]:
    data = await jmap([["x:Domain/query", {"filter": {}}, "domains"]])
    result = method_result(data, "domain query")
    return {"domains": result.get("ids", [])}



@app.post("/api/domains/verification", dependencies=[Depends(require_control_plane_token)])
async def request_domain_verification(body: DomainCreate) -> dict[str, Any]:
    require_allowed_domain(body.domain)
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    expires_at = int(time.time()) + DOMAIN_VERIFICATION_TTL_SECONDS
    connection = domain_verification_db()
    try:
        connection.execute(
            "INSERT INTO domain_verifications(domain,token_hash,expires_at,verified_at) VALUES(?,?,?,NULL) "
            "ON CONFLICT(domain) DO UPDATE SET token_hash=excluded.token_hash,expires_at=excluded.expires_at,verified_at=NULL",
            (body.domain, token_hash, expires_at),
        )
    finally:
        connection.close()
    return {
        "domain": body.domain,
        "record_type": "TXT",
        "record_name": f"_izakhono-verify.{body.domain}",
        "record_value": f"izakhono-verification={token}",
        "expires_at": expires_at,
        "instruction": "Publish this TXT record, wait for DNS propagation, then call /api/domains/verify.",
    }


@app.post("/api/domains/verify", dependencies=[Depends(require_control_plane_token)])
async def verify_domain_ownership(body: DomainCreate) -> dict[str, Any]:
    require_allowed_domain(body.domain)
    connection = domain_verification_db()
    try:
        row = connection.execute(
            "SELECT token_hash,expires_at,verified_at FROM domain_verifications WHERE domain=?",
            (body.domain,),
        ).fetchone()
        if not row:
            raise HTTPException(404, "No domain verification request exists")
        if row[2]:
            return {"domain": body.domain, "status": "verified", "verified_at": row[2]}
        if int(row[1]) < int(time.time()):
            raise HTTPException(410, "Domain verification token has expired")
        try:
            answers = dns.resolver.resolve(f"_izakhono-verify.{body.domain}", "TXT", lifetime=8)
        except (dns.exception.DNSException, OSError) as exc:
            raise HTTPException(409, "Domain verification TXT record was not found") from exc
        values = []
        for answer in answers:
            values.append(b"".join(answer.strings).decode("utf-8", errors="replace"))
        matched = False
        for value in values:
            prefix = "izakhono-verification="
            if value.startswith(prefix):
                candidate = value[len(prefix):]
                candidate_hash = hashlib.sha256(candidate.encode("utf-8")).hexdigest()
                if secrets.compare_digest(candidate_hash, row[0]):
                    matched = True
                    break
        if not matched:
            raise HTTPException(409, "Domain verification TXT value does not match")
        verified_at = int(time.time())
        connection.execute(
            "UPDATE domain_verifications SET verified_at=? WHERE domain=?",
            (verified_at, body.domain),
        )
    finally:
        connection.close()
    return {"domain": body.domain, "status": "verified", "verified_at": verified_at}


@app.post("/api/domains", dependencies=[Depends(require_control_plane_token)])
async def create_domain(body: DomainCreate) -> dict[str, Any]:
    require_verified_domain(body.domain)
    data = await jmap([
        [
            "x:Domain/set",
            {
                "create": {
                    "new": {
                        "name": body.domain,
                        "aliases": {},
                        "certificateManagement": {"@type": "Manual"},
                        "dnsManagement": {"@type": "Manual"},
                        "dkimManagement": {"@type": "Automatic"},
                        "subAddressing": {"@type": "Enabled"},
                    }
                }
            },
            "create-domain",
        ]
    ])
    return {"result": method_result(data, "domain creation")}


@app.post("/api/mailboxes", dependencies=[Depends(require_control_plane_token)])
async def create_mailbox(body: MailboxCreate) -> dict[str, Any]:
    require_verified_domain(body.domain)
    # Provision the mail domain on first use. Repeated requests reuse its
    # existing Stalwart domain ID instead of failing with "domain missing".
    query = await jmap([
        ["x:Domain/query", {"filter": {"name": body.domain}}, "domain-query"]
    ])
    domain_result = method_result(query, "domain query")
    domain_ids = domain_result.get("ids", [])

    if domain_ids:
        domain_id = domain_ids[0]
    else:
        created_domain = await jmap([
            [
                "x:Domain/set",
                {
                    "create": {
                        "new": {
                            "name": body.domain,
                            "aliases": {},
                            "certificateManagement": {"@type": "Manual"},
                            "dnsManagement": {"@type": "Manual"},
                            "dkimManagement": {"@type": "Automatic"},
                            "subAddressing": {"@type": "Enabled"},
                        }
                    }
                },
                "create-domain",
            ]
        ])
        created_result = method_result(created_domain, "domain creation")
        domain_id = created_result.get("created", {}).get("new", {}).get("id")
        if not domain_id:
            if created_result.get("notCreated"):
                raise HTTPException(409, "Mail domain creation was rejected or conflicted")
            raise HTTPException(502, "Mail server did not return the new domain ID")

    # Make mailbox provisioning idempotent: never silently create a duplicate.
    account_query = await jmap([
        [
            "x:Account/query",
            {"filter": {"name": body.local_part, "domainId": domain_id}},
            "account-query",
        ]
    ])
    account_result = method_result(account_query, "account query")
    if account_result.get("ids"):
        raise HTTPException(409, "Mailbox already exists")

    # Validate encryption/storage configuration before creating an account.
    handover_cipher()
    temporary_password = secrets.token_urlsafe(24)
    address = f"{body.local_part}@{body.domain}"
    handover_token = store_handover(address)
    try:
        data = await jmap([
        [
            "x:Account/set",
            {
                "create": {
                    "new": {
                        "@type": "User",
                        "name": body.local_part,
                        "domainId": domain_id,
                        "description": body.display_name,
                        "credentials": {
                            "0": {"@type": "Password", "secret": temporary_password}
                        },
                        "aliases": {},
                        "memberGroupIds": {},
                        # New mailboxes cannot send or receive until the owner
                        # completes the first password change in the customer portal.
                        "permissions": {
                            "@type": "Merge",
                            "enabledPermissions": {},
                            "disabledPermissions": {"emailSend": True},
                        },
                        "quotas": {},
                        "roles": {"@type": "User"},
                        "encryptionAtRest": {"@type": "Disabled"},
                    }
                }
            },
            "create-mailbox",
        ]
    ])
        result = method_result(data, "mailbox creation")
        if result.get("notCreated"):
            raise HTTPException(409, "Mailbox creation was rejected or conflicted")
    except Exception:
        discard_handover(handover_token)
        raise
    return {
        "result": result,
        "address": address,
        "handover_token": handover_token,
        "handover_expires_in_seconds": HANDOVER_TTL_SECONDS,
        "activation_expires_in_seconds": ACTIVATION_TTL_SECONDS,
        "handover_policy": "The handover link can be redeemed once within 15 minutes. The customer then has 24 hours to set a new password and activate outbound sending. No temporary password is disclosed.",
    }



async def activate_mailbox_delivery(email: str) -> None:
    local_part, domain = email.rsplit("@", 1)
    domain_data = await jmap([
        ["x:Domain/query", {"filter": {"name": domain}}, "activation-domain-query"]
    ])
    domain_ids = method_result(domain_data, "activation domain query").get("ids", [])
    if not domain_ids:
        raise HTTPException(503, "Mailbox activation is pending administrator review")
    account_data = await jmap([
        ["x:Account/query", {"filter": {"name": local_part, "domainId": domain_ids[0]}}, "activation-account-query"]
    ])
    account_ids = method_result(account_data, "activation account query").get("ids", [])
    if not account_ids:
        raise HTTPException(503, "Mailbox activation is pending administrator review")
    update_data = await jmap([
        ["x:Account/set", {"update": {account_ids[0]: {"permissions": {"@type": "Inherit"}}}}, "activate-mailbox"]
    ])
    result = method_result(update_data, "mailbox activation")
    if result.get("notUpdated"):
        raise HTTPException(503, "Password changed, but mailbox delivery activation is pending")



@app.post("/api/account/password")
async def change_account_password(body: PasswordChange) -> dict[str, str]:
    email = body.email.strip().lower()
    if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", email):
        raise HTTPException(400, "A valid mailbox address is required")
    if body.new_password == body.current_password:
        raise HTTPException(400, "Choose a password different from the current password")
    if not any(char.islower() for char in body.new_password) or not any(char.isupper() for char in body.new_password) or not any(char.isdigit() for char in body.new_password):
        raise HTTPException(400, "New password must include upper-case, lower-case and numeric characters")

    payload = {
        "using": JMAP_CAPS,
        "methodCalls": [[
            "x:AccountPassword/set",
            {"update": {"singleton": {
                "currentSecret": body.current_password,
                "secret": body.new_password,
            }}},
            "password-change",
        ]],
    }
    try:
        async with httpx.AsyncClient(timeout=15, auth=(email, body.current_password)) as client:
            response = await client.post(jmap_url(), headers={"Content-Type": "application/json"}, json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(502, "Password service is unavailable") from exc
    if response.status_code in (401, 403):
        raise HTTPException(401, "Current mailbox credentials could not be verified. If two-factor authentication is enabled, use the Stalwart Account Manager.")
    if response.status_code >= 400:
        raise HTTPException(502, "Mail server rejected the password change")
    try:
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("Invalid JMAP response")
        method_responses = data.get("methodResponses", [])
        if (
            not isinstance(method_responses, list)
            or not method_responses
            or not isinstance(method_responses[0], list)
            or len(method_responses[0]) < 2
            or method_responses[0][0] == "error"
        ):
            raise ValueError("JMAP password change failed")
        result = method_responses[0][1]
        if not isinstance(result, dict) or result.get("notUpdated"):
            raise ValueError("JMAP password change was not accepted")
    except (ValueError, TypeError, KeyError) as exc:
        raise HTTPException(400, "Password change was not accepted; verify the current mailbox password.") from exc
    try:
        await activate_mailbox_delivery(email)
    except HTTPException as exc:
        raise HTTPException(503, "Your password changed, but mailbox sending is still locked. Contact the mail administrator to complete activation.") from exc
    return {"status": "password_changed", "message": "Your password has been changed and mailbox sending is now activated."}



@app.post("/api/account/activate")
async def activate_account(body: MailboxActivate) -> dict[str, str]:
    return await activate_mailbox_with_token(body.activation_token, body.new_password)


@app.post("/api/mailboxes/handover")
async def retrieve_mailbox_handover(body: HandoverRetrieve) -> dict[str, str]:
    # Possession of a high-entropy, short-lived token is the authorization.
    # The database transaction deletes the token before returning credentials.
    result = consume_handover(body.handover_token)
    if not result:
        raise HTTPException(410, "Handover token is invalid, expired, or already used")
    return result
