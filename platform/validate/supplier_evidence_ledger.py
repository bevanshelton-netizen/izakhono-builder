"""Append-only local supplier evidence ledger with tamper-evident hash chaining.

This tool reads and writes only an explicitly selected local JSONL ledger.
It does not contact suppliers, fetch URLs, store source documents, or call APIs.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker

ROOT = Path(__file__).resolve().parent
SCHEMA_PATH = ROOT / "schemas/supplier-evidence-event.schema.json"
GENESIS = None


def load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def canonical_json(value: dict[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def event_digest(event: dict[str, Any]) -> str:
    payload = {key: value for key, value in event.items() if key != "eventHash"}
    return hashlib.sha256(canonical_json(payload)).hexdigest()


def validate_event(event: dict[str, Any], schema: dict[str, Any]) -> list[str]:
    errors = sorted(
        Draft202012Validator(schema, format_checker=FormatChecker()).iter_errors(event),
        key=lambda error: list(map(str, error.absolute_path)),
    )
    return [f"/{'/'.join(map(str, error.absolute_path)) or '<root>'}: {error.message}" for error in errors]


def read_ledger(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []
    events = []
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, 1):
            if not line.strip():
                raise ValueError(f"blank ledger line at {line_number}; ledger must be canonical JSONL")
            try:
                event = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"invalid JSON on ledger line {line_number}: {exc}") from exc
            if not isinstance(event, dict):
                raise ValueError(f"ledger line {line_number} must contain a JSON object")
            events.append(event)
    return events


def verify_ledger(events: list[dict[str, Any]], schema: dict[str, Any]) -> dict[str, Any]:
    previous_hash = GENESIS
    errors: list[str] = []
    seen_ids: set[str] = set()
    for expected_sequence, event in enumerate(events, 1):
        line = expected_sequence
        schema_errors = validate_event(event, schema)
        errors.extend(f"line {line}: {item}" for item in schema_errors)
        if event.get("sequence") != expected_sequence:
            errors.append(f"line {line}: sequence must be {expected_sequence}")
        if event.get("previousEventHash") != previous_hash:
            errors.append(f"line {line}: previousEventHash does not match preceding event")
        actual_hash = event_digest(event)
        if event.get("eventHash") != actual_hash:
            errors.append(f"line {line}: eventHash mismatch; record may have been altered")
        event_id = event.get("eventId")
        if event_id in seen_ids:
            errors.append(f"line {line}: duplicate eventId {event_id}")
        seen_ids.add(event_id)
        previous_hash = event.get("eventHash")
    return {
        "valid": not errors,
        "eventCount": len(events),
        "headHash": previous_hash,
        "errors": errors,
        "integrityNote": "Hash chaining detects changes relative to the supplied ledger sequence; protect an independently stored head hash to detect truncation or wholesale replacement.",
    }


def append_event(path: Path, event: dict[str, Any], schema: dict[str, Any]) -> dict[str, Any]:
    path.parent.mkdir(parents=True, exist_ok=True)
    events = read_ledger(path)
    current = verify_ledger(events, schema)
    if not current["valid"]:
        raise ValueError("refusing to append to an invalid ledger: " + "; ".join(current["errors"]))
    event = dict(event)
    event["sequence"] = len(events) + 1
    event["previousEventHash"] = current["headHash"]
    event["eventHash"] = event_digest(event)
    errors = validate_event(event, schema)
    if errors:
        raise ValueError("invalid evidence event: " + "; ".join(errors))
    if any(existing.get("eventId") == event.get("eventId") for existing in events):
        raise ValueError(f"duplicate eventId: {event.get('eventId')}")
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, sort_keys=True, ensure_ascii=False) + "\n")
        handle.flush()
    return {"appended": True, "sequence": event["sequence"], "eventHash": event["eventHash"]}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)
    verify_parser = subparsers.add_parser("verify", help="verify a local JSONL evidence ledger")
    verify_parser.add_argument("--ledger", type=Path, required=True)
    append_parser = subparsers.add_parser("append", help="append a reviewed event from a local JSON file")
    append_parser.add_argument("--ledger", type=Path, required=True)
    append_parser.add_argument("--event", type=Path, required=True)
    args = parser.parse_args()
    try:
        schema = load_json(SCHEMA_PATH)
        Draft202012Validator.check_schema(schema)
        if args.command == "verify":
            result = verify_ledger(read_ledger(args.ledger), schema)
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0 if result["valid"] else 1
        result = append_event(args.ledger, load_json(args.event), schema)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (OSError, json.JSONDecodeError, ValueError, KeyError) as exc:
        print(f"SUPPLIER EVIDENCE LEDGER ERROR: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
