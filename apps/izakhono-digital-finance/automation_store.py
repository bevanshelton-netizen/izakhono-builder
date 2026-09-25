#!/usr/bin/env python3
"""Pseudonymous SQLite state store for IZAKHONO Digital Finance workforce autopilot."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STATE_FIELDS = {
    "learner_ref",
    "institution_ref",
    "role",
    "stage",
    "baseline_score",
    "final_score",
    "attempts",
    "completed_modules",
    "total_modules",
    "exception_codes",
    "identity_verified",
    "payment_entitled",
}

PII_FIELDS = {
    "name", "first_name", "last_name", "email", "phone", "mobile",
    "id_number", "identity_number", "passport", "address", "date_of_birth",
}


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def sanitize_state(payload: dict[str, Any]) -> dict[str, Any]:
    pii = sorted(set(payload) & PII_FIELDS)
    if pii:
        raise ValueError("pii_fields_rejected:" + ",".join(pii))

    unknown = sorted(set(payload) - STATE_FIELDS)
    if unknown:
        raise ValueError("unapproved_fields:" + ",".join(unknown))

    learner_ref = payload.get("learner_ref")
    institution_ref = payload.get("institution_ref")
    if not isinstance(learner_ref, str) or not learner_ref.strip():
        raise ValueError("learner_ref_required")
    if not isinstance(institution_ref, str) or not institution_ref.strip():
        raise ValueError("institution_ref_required")
    if len(learner_ref) > 96 or len(institution_ref) > 96:
        raise ValueError("reference_too_long")

    clean = {key: payload[key] for key in STATE_FIELDS if key in payload}
    clean["learner_ref"] = learner_ref.strip()
    clean["institution_ref"] = institution_ref.strip()
    clean.setdefault("role", "general_employee")
    clean.setdefault("stage", "onboarding")
    clean.setdefault("attempts", 0)
    clean.setdefault("completed_modules", 0)
    clean.setdefault("total_modules", 0)
    clean.setdefault("identity_verified", False)
    clean.setdefault("payment_entitled", False)
    clean.setdefault("exception_codes", [])
    return clean


class AutomationStore:
    def __init__(self, path: str | Path):
        self.path = str(path)
        parent = Path(self.path).expanduser().resolve().parent
        parent.mkdir(parents=True, exist_ok=True)
        self._init()

    def connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init(self) -> None:
        with self.connect() as conn:
            conn.executescript(
                """
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS learners (
                    learner_ref TEXT PRIMARY KEY,
                    institution_ref TEXT NOT NULL,
                    role TEXT NOT NULL,
                    stage TEXT NOT NULL,
                    learning_path TEXT,
                    baseline_score REAL,
                    final_score REAL,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    completed_modules INTEGER NOT NULL DEFAULT 0,
                    total_modules INTEGER NOT NULL DEFAULT 0,
                    identity_verified INTEGER NOT NULL DEFAULT 0,
                    payment_entitled INTEGER NOT NULL DEFAULT 0,
                    last_decision TEXT,
                    human_review INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_learners_institution
                    ON learners(institution_ref);

                CREATE TABLE IF NOT EXISTS events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    institution_ref TEXT NOT NULL,
                    learner_ref TEXT NOT NULL,
                    event_type TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    decision_json TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_events_institution
                    ON events(institution_ref, created_at);

                CREATE TABLE IF NOT EXISTS outbox (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    institution_ref TEXT NOT NULL,
                    learner_ref TEXT NOT NULL,
                    action TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at TEXT NOT NULL,
                    processed_at TEXT
                );

                CREATE INDEX IF NOT EXISTS idx_outbox_pending
                    ON outbox(institution_ref, status, created_at);
                """
            )

    def record_decision(self, payload: dict[str, Any], decision: dict[str, Any]) -> dict[str, Any]:
        state = sanitize_state(payload)
        now = utc_now()
        next_stage = decision.get("next_stage") or state.get("stage") or "onboarding"
        learning_path = decision.get("path")
        human_review = 1 if decision.get("decision") == "human_review" else 0

        with self.connect() as conn:
            existing = conn.execute(
                "SELECT created_at FROM learners WHERE learner_ref = ?",
                (state["learner_ref"],),
            ).fetchone()
            created_at = existing["created_at"] if existing else now

            conn.execute(
                """
                INSERT INTO learners (
                    learner_ref, institution_ref, role, stage, learning_path,
                    baseline_score, final_score, attempts, completed_modules,
                    total_modules, identity_verified, payment_entitled,
                    last_decision, human_review, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(learner_ref) DO UPDATE SET
                    institution_ref=excluded.institution_ref,
                    role=excluded.role,
                    stage=excluded.stage,
                    learning_path=COALESCE(excluded.learning_path, learners.learning_path),
                    baseline_score=COALESCE(excluded.baseline_score, learners.baseline_score),
                    final_score=COALESCE(excluded.final_score, learners.final_score),
                    attempts=excluded.attempts,
                    completed_modules=excluded.completed_modules,
                    total_modules=excluded.total_modules,
                    identity_verified=excluded.identity_verified,
                    payment_entitled=excluded.payment_entitled,
                    last_decision=excluded.last_decision,
                    human_review=excluded.human_review,
                    updated_at=excluded.updated_at
                """,
                (
                    state["learner_ref"],
                    state["institution_ref"],
                    state.get("role", "general_employee"),
                    next_stage,
                    learning_path,
                    state.get("baseline_score"),
                    state.get("final_score"),
                    int(state.get("attempts", 0) or 0),
                    int(state.get("completed_modules", 0) or 0),
                    int(state.get("total_modules", 0) or 0),
                    1 if state.get("identity_verified") else 0,
                    1 if state.get("payment_entitled") else 0,
                    decision.get("decision"),
                    human_review,
                    created_at,
                    now,
                ),
            )

            conn.execute(
                """
                INSERT INTO events (
                    institution_ref, learner_ref, event_type, state_json,
                    decision_json, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    state["institution_ref"],
                    state["learner_ref"],
                    str(state.get("stage") or "onboarding"),
                    json.dumps(state, ensure_ascii=False, separators=(",", ":")),
                    json.dumps(decision, ensure_ascii=False, separators=(",", ":")),
                    now,
                ),
            )

            for action in decision.get("next_actions") or []:
                conn.execute(
                    """
                    INSERT INTO outbox (
                        institution_ref, learner_ref, action, payload_json,
                        status, created_at
                    ) VALUES (?, ?, ?, ?, 'pending', ?)
                    """,
                    (
                        state["institution_ref"],
                        state["learner_ref"],
                        str(action),
                        json.dumps(
                            {
                                "decision": decision.get("decision"),
                                "next_stage": decision.get("next_stage"),
                            },
                            ensure_ascii=False,
                            separators=(",", ":"),
                        ),
                        now,
                    ),
                )

        return {
            "stored": True,
            "learner_ref": state["learner_ref"],
            "institution_ref": state["institution_ref"],
            "stage": next_stage,
            "decision": decision.get("decision"),
            "human_review": bool(human_review),
        }

    def report(self, institution_ref: str) -> dict[str, Any]:
        if not institution_ref or len(institution_ref) > 96:
            raise ValueError("valid_institution_ref_required")

        with self.connect() as conn:
            totals = conn.execute(
                """
                SELECT
                    COUNT(*) AS learners,
                    SUM(CASE WHEN human_review = 1 THEN 1 ELSE 0 END) AS human_review,
                    SUM(CASE WHEN last_decision IN ('complete','certificate_eligible','completion_eligible') THEN 1 ELSE 0 END) AS completion_track
                FROM learners
                WHERE institution_ref = ?
                """,
                (institution_ref,),
            ).fetchone()

            stages = conn.execute(
                """
                SELECT stage, COUNT(*) AS count
                FROM learners
                WHERE institution_ref = ?
                GROUP BY stage
                ORDER BY stage
                """,
                (institution_ref,),
            ).fetchall()

            pending = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM outbox
                WHERE institution_ref = ? AND status = 'pending'
                """,
                (institution_ref,),
            ).fetchone()

        return {
            "institution_ref": institution_ref,
            "learners": int(totals["learners"] or 0),
            "human_review": int(totals["human_review"] or 0),
            "completion_track": int(totals["completion_track"] or 0),
            "pending_actions": int(pending["count"] or 0),
            "stages": {row["stage"]: int(row["count"]) for row in stages},
        }

    def pending_actions(self, institution_ref: str, limit: int = 100) -> list[dict[str, Any]]:
        if not institution_ref or len(institution_ref) > 96:
            raise ValueError("valid_institution_ref_required")
        limit = max(1, min(int(limit), 500))

        with self.connect() as conn:
            rows = conn.execute(
                """
                SELECT id, learner_ref, action, payload_json, created_at
                FROM outbox
                WHERE institution_ref = ? AND status = 'pending'
                ORDER BY id
                LIMIT ?
                """,
                (institution_ref, limit),
            ).fetchall()

        return [
            {
                "id": int(row["id"]),
                "learner_ref": row["learner_ref"],
                "action": row["action"],
                "payload": json.loads(row["payload_json"]),
                "created_at": row["created_at"],
            }
            for row in rows
        ]

    def ack_action(self, institution_ref: str, action_id: int) -> bool:
        now = utc_now()
        with self.connect() as conn:
            cur = conn.execute(
                """
                UPDATE outbox
                SET status = 'processed', processed_at = ?
                WHERE id = ? AND institution_ref = ? AND status = 'pending'
                """,
                (now, int(action_id), institution_ref),
            )
            return cur.rowcount == 1
