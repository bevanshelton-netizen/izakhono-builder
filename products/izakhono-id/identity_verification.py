"""Provider-independent, entity-scoped identity verification for IZAKHONO ID.

This module is a controlled integration boundary, not a live Regula client.
A licensed Regula gateway is injected after vendor sandbox and legal approval.
"""
from __future__ import annotations
import hashlib, json, secrets, sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Literal, Protocol

Check = Literal["passed", "failed", "not_run", "indeterminate"]
Status = Literal["pending", "in_progress", "verified", "review_required", "incomplete", "provider_unavailable", "cancelled"]

# Conservative server-side ceiling when a provider omits its own expiry.
DEFAULT_SESSION_TTL_SECONDS = 15 * 60

def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()

def sha256(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()

def expiry_has_passed(value: str | None, now: datetime | None = None) -> bool:
    """Treat malformed expiry metadata as expired; never poll beyond expiry."""
    if not isinstance(value, str) or not value.strip():
        return True
    try:
        expiry = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
        current = now or datetime.now(timezone.utc)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        return current >= expiry
    except (TypeError, ValueError, OverflowError):
        return True

@dataclass(frozen=True)
class VerificationRequest:
    entity_id: str
    subject_ref: str
    purpose: str
    jurisdiction: str
    idempotency_key: str
    notice_version: str

@dataclass(frozen=True)
class VerificationStart:
    provider_session_ref: str
    client_token: str | None = None
    expires_at: str | None = None

@dataclass(frozen=True)
class VerificationOutcome:
    document_authenticity: Check
    document_consistency: Check
    face_match: Check
    liveness: Check
    evidence_refs: tuple[str, ...] = ()
    completed_at: str | None = None
    def public_dict(self) -> dict[str, Any]:
        return asdict(self)

class VerificationProvider(Protocol):
    provider_id: str
    def health(self) -> bool: ...
    def start(self, request: VerificationRequest) -> VerificationStart: ...
    def retrieve(self, provider_session_ref: str) -> VerificationOutcome: ...
    def cancel(self, provider_session_ref: str) -> None: ...

class RegulaTransport(Protocol):
    """Implement against the licensed Regula IDV/Document Reader/Face SDK contract."""
    def health(self) -> bool: ...
    def create_verification(self, *, entity_ref: str, subject_ref_hash: str, idempotency_key_hash: str, jurisdiction: str, purpose: str, notice_version: str) -> VerificationStart: ...
    def get_verification(self, provider_session_ref: str) -> VerificationOutcome: ...
    def cancel_verification(self, provider_session_ref: str) -> None: ...

class RegulaProvider:
    provider_id = "regula"
    def __init__(self, transport: RegulaTransport):
        self.transport = transport
    def health(self) -> bool:
        return bool(self.transport.health())
    def start(self, request: VerificationRequest) -> VerificationStart:
        return self.transport.create_verification(
            entity_ref=request.entity_id,
            subject_ref_hash=sha256(request.subject_ref),
            idempotency_key_hash=sha256(request.idempotency_key),
            jurisdiction=request.jurisdiction,
            purpose=request.purpose,
            notice_version=request.notice_version,
        )
    def retrieve(self, provider_session_ref: str) -> VerificationOutcome:
        return self.transport.get_verification(provider_session_ref)
    def cancel(self, provider_session_ref: str) -> None:
        self.transport.cancel_verification(provider_session_ref)

def decide_status(outcome: VerificationOutcome) -> Status:
    required = (outcome.document_authenticity, outcome.document_consistency, outcome.face_match, outcome.liveness)
    if all(value == "passed" for value in required):
        return "verified"
    if all(value == "not_run" for value in required):
        return "incomplete"
    # A wholly indeterminate provider response means processing is not yet
    # interpretable; keep polling rather than prematurely closing the session.
    if all(value == "indeterminate" for value in required):
        return "in_progress"
    # A failed, ambiguous or partial check is never auto-approved or silently rejected.
    return "review_required"

class IdentityVerificationService:
    """Entity-scoped orchestration. Caller must authenticate and authorize entity_id."""
    def __init__(self, db_path: str, providers: list[VerificationProvider],
                 preferred_provider: str = "regula", allowed_providers: tuple[str, ...] = ("regula",)):
        self.db_path = db_path
        self.providers = {provider.provider_id: provider for provider in providers}
        self.preferred_provider = preferred_provider
        self.allowed_providers = allowed_providers
        if preferred_provider not in allowed_providers:
            raise ValueError("preferred_provider_not_allowed")

    def connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.db_path, timeout=10)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def initialize(self) -> None:
        with self.connect() as db:
            db.execute("""
                CREATE TABLE IF NOT EXISTS identity_verification_sessions (
                    id TEXT PRIMARY KEY,
                    entity_id TEXT NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
                    subject_ref TEXT NOT NULL,
                    purpose TEXT NOT NULL,
                    jurisdiction TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    provider_session_ref TEXT,
                    status TEXT NOT NULL CHECK(status IN (
                        'pending','in_progress','verified','review_required',
                        'incomplete','provider_unavailable','cancelled'
                    )),
                    idempotency_hash TEXT NOT NULL,
                    notice_version TEXT NOT NULL,
                    outcome_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    expires_at TEXT,
                    completed_at TEXT,
                    UNIQUE(entity_id, idempotency_hash),
                    UNIQUE(entity_id, id)
                )
            """)
            db.execute("""
                CREATE INDEX IF NOT EXISTS idx_idv_entity_subject
                ON identity_verification_sessions(entity_id, subject_ref, created_at)
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS identity_verification_evidence_refs (
                    id TEXT PRIMARY KEY,
                    entity_id TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    evidence_ref TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY(entity_id, session_id)
                      REFERENCES identity_verification_sessions(entity_id, id)
                      ON DELETE CASCADE,
                    UNIQUE(entity_id, session_id, evidence_ref)
                )
            """)
            db.commit()

    def _audit(self, db: sqlite3.Connection, event: str, entity_id: str, subject_ref: str, detail: str) -> None:
        db.execute(
            """INSERT INTO audit_events(id,event_type,entity_id,user_id,subject_hash,detail,created_at)
               VALUES(?,?,?,?,?,?,?)""",
            ("idva_" + secrets.token_hex(12), event, entity_id, None,
             sha256(subject_ref), detail[:240], utc_now()),
        )

    def _row(self, row: sqlite3.Row) -> dict[str, Any]:
        return {key: row[key] for key in row.keys()}

    def start(self, request: VerificationRequest) -> dict[str, Any]:
        if not all((request.entity_id, request.subject_ref, request.purpose,
                    request.jurisdiction, request.idempotency_key, request.notice_version)):
            raise ValueError("verification_request_fields_required")
        if len(request.subject_ref) > 160 or len(request.idempotency_key) > 200:
            raise ValueError("verification_reference_too_long")
        if self.preferred_provider not in self.allowed_providers:
            raise PermissionError("verification_provider_not_allowed")
        provider = self.providers.get(self.preferred_provider)
        if provider is None:
            raise RuntimeError("verification_provider_not_configured")

        idem_hash = sha256(request.idempotency_key)
        with self.connect() as db:
            entity = db.execute("SELECT id,status FROM entities WHERE id=?", (request.entity_id,)).fetchone()
            if not entity or entity["status"] != "active":
                raise PermissionError("entity_inactive_or_unknown")
            existing = db.execute(
                "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND idempotency_hash=?",
                (request.entity_id, idem_hash),
            ).fetchone()
            if existing:
                # Retry only unfinished provider starts, using the same vendor idempotency key.
                # A completed or already-created provider session is returned unchanged.
                if existing["provider_session_ref"] or existing["status"] not in ("pending", "provider_unavailable"):
                    return self._row(existing)
                session_id = existing["id"]
            else:
                session_id = "idv_" + secrets.token_urlsafe(18)
                now = utc_now()
                db.execute(
                    """INSERT INTO identity_verification_sessions(
                        id,entity_id,subject_ref,purpose,jurisdiction,provider,status,
                        idempotency_hash,notice_version,created_at,updated_at
                    ) VALUES(?,?,?,?,?,?,'pending',?,?,?,?)""",
                    (session_id, request.entity_id, request.subject_ref, request.purpose,
                     request.jurisdiction, provider.provider_id, idem_hash, request.notice_version, now, now),
                )
                self._audit(db, "identity_verification.started", request.entity_id,
                            request.subject_ref, "provider_session_initializing")
                db.commit()

        try:
            if not provider.health():
                raise RuntimeError("provider_unavailable")
            started = provider.start(request)
            if not started.provider_session_ref:
                raise RuntimeError("provider_session_reference_missing")
        except Exception:
            with self.connect() as db:
                db.execute(
                    """UPDATE identity_verification_sessions
                       SET status='provider_unavailable',updated_at=?
                       WHERE entity_id=? AND id=? AND status='pending'""",
                    (utc_now(), request.entity_id, session_id),
                )
                self._audit(db, "identity_verification.provider_unavailable",
                            request.entity_id, request.subject_ref, "provider_start_failed")
                db.commit()
            raise RuntimeError("identity_verification_provider_unavailable") from None

        # Every externally usable session receives a finite server-side expiry.
        # Retain a provider expiry when supplied; otherwise impose a conservative
        # local TTL instead of creating an unbounded session.
        effective_expiry = started.expires_at
        if effective_expiry is None:
            effective_expiry = (
                datetime.now(timezone.utc) + timedelta(seconds=DEFAULT_SESSION_TTL_SECONDS)
            ).isoformat()

        with self.connect() as db:
            db.execute(
                """UPDATE identity_verification_sessions
                   SET provider_session_ref=?,status='in_progress',expires_at=?,updated_at=?
                   WHERE entity_id=? AND id=?""",
                (started.provider_session_ref, effective_expiry, utc_now(), request.entity_id, session_id),
            )
            db.commit()
            row = db.execute(
                "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                (request.entity_id, session_id),
            ).fetchone()
            result = self._row(row)
            result["client_token"] = started.client_token  # returned once; never persisted
            return result

    def refresh(self, entity_id: str, session_id: str) -> dict[str, Any]:
        terminal = ("verified", "review_required", "incomplete", "cancelled")
        with self.connect() as db:
            row = db.execute(
                "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                (entity_id, session_id),
            ).fetchone()
            if not row:
                raise LookupError("verification_session_not_found")
            if row["status"] in terminal:
                return self._row(row)
            if expiry_has_passed(row["expires_at"]):
                now = utc_now()
                changed = db.execute(
                    """UPDATE identity_verification_sessions
                       SET status='incomplete',completed_at=?,updated_at=?
                       WHERE entity_id=? AND id=?
                         AND status IN ('pending','in_progress','provider_unavailable')""",
                    (now, now, entity_id, session_id),
                ).rowcount
                if changed:
                    self._audit(db, "identity_verification.expired", entity_id,
                                row["subject_ref"], "provider_session_expired")
                db.commit()
                current = db.execute(
                    "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                    (entity_id, session_id),
                ).fetchone()
                return self._row(current)
            provider = self.providers.get(row["provider"])
            provider_ref = row["provider_session_ref"]
            if provider is None or not provider_ref:
                raise RuntimeError("verification_provider_session_unavailable")

        try:
            outcome = provider.retrieve(provider_ref)
            status = decide_status(outcome)
        except Exception:
            raise RuntimeError("verification_result_unavailable") from None

        with self.connect() as db:
            current = db.execute(
                "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                (entity_id, session_id),
            ).fetchone()
            if not current:
                raise LookupError("verification_session_not_found")
            # A cancellation or another terminal result may have won while the
            # provider request was in flight. Never overwrite that decision.
            if current["status"] in terminal:
                return self._row(current)

            now = utc_now()
            if expiry_has_passed(current["expires_at"]):
                changed = db.execute(
                    """UPDATE identity_verification_sessions
                       SET status='incomplete',completed_at=?,updated_at=?
                       WHERE entity_id=? AND id=?
                         AND status IN ('pending','in_progress','provider_unavailable')""",
                    (now, now, entity_id, session_id),
                ).rowcount
                if changed:
                    self._audit(db, "identity_verification.expired", entity_id,
                                current["subject_ref"], "provider_session_expired_during_poll")
                db.commit()
                final_row = db.execute(
                    "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                    (entity_id, session_id),
                ).fetchone()
                return self._row(final_row)

            changed = db.execute(
                """UPDATE identity_verification_sessions
                   SET status=?,outcome_json=?,completed_at=?,updated_at=?
                   WHERE entity_id=? AND id=?
                     AND status IN ('pending','in_progress','provider_unavailable')""",
                (status, json.dumps(outcome.public_dict(), separators=(",", ":")),
                 outcome.completed_at if status in ("verified", "review_required") else None,
                 now, entity_id, session_id),
            ).rowcount
            if changed:
                for evidence_ref in outcome.evidence_refs:
                    if evidence_ref and len(evidence_ref) <= 240:
                        db.execute(
                            """INSERT OR IGNORE INTO identity_verification_evidence_refs
                               (id,entity_id,session_id,provider,evidence_ref,created_at)
                               VALUES(?,?,?,?,?,?)""",
                            ("idve_" + secrets.token_hex(12), entity_id, session_id,
                             current["provider"], evidence_ref, now),
                        )
                self._audit(db, "identity_verification.result_recorded", entity_id,
                            current["subject_ref"], "status=" + status)
            db.commit()
            updated = db.execute(
                "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                (entity_id, session_id),
            ).fetchone()
            return self._row(updated)

    def cancel(self, entity_id: str, session_id: str) -> None:
        terminal = ("verified", "review_required", "incomplete", "cancelled")
        with self.connect() as db:
            row = db.execute(
                "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                (entity_id, session_id),
            ).fetchone()
            if not row:
                raise LookupError("verification_session_not_found")
            if row["status"] in terminal:
                return
            now = utc_now()
            changed = db.execute(
                """UPDATE identity_verification_sessions
                   SET status='cancelled',updated_at=?
                   WHERE entity_id=? AND id=?
                     AND status IN ('pending','in_progress','provider_unavailable')""",
                (now, entity_id, session_id),
            ).rowcount
            if changed:
                self._audit(db, "identity_verification.cancelled", entity_id,
                            row["subject_ref"], "cancelled_by_authorized_entity")
            db.commit()
            current = db.execute(
                "SELECT * FROM identity_verification_sessions WHERE entity_id=? AND id=?",
                (entity_id, session_id),
            ).fetchone()
            if not changed or current["status"] != "cancelled":
                return
            provider = self.providers.get(row["provider"])
            provider_ref = row["provider_session_ref"]

        # Local cancellation is committed first so a concurrent poll cannot
        # resurrect the session if the vendor cancellation request is delayed.
        if provider and provider_ref:
            try:
                provider.cancel(provider_ref)
            except Exception:
                raise RuntimeError("verification_provider_cancel_unavailable") from None
