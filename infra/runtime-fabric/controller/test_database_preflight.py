"""Disposable PostgreSQL tests for the read-only Runtime Fabric binding preflight."""

from __future__ import annotations

import os

import pytest

DATABASE_URL = os.getenv("DEPLOY_TEST_DATABASE_URL")


@pytest.mark.skipif(not DATABASE_URL, reason="requires disposable DEPLOY_TEST_DATABASE_URL")
def test_preflight_checks_both_stores_read_only_and_never_authorizes_production():
    import psycopg

    from database_preflight import inspect_runtime_database

    with psycopg.connect(DATABASE_URL) as conn:
        before = conn.execute("SELECT count(*) FROM fortress_audit_events").fetchone()[0]

    report = inspect_runtime_database(
        lambda: psycopg.connect(DATABASE_URL),
        {
            "database_id": "ci-disposable-db",
            "environment": "ci",
            "owner": "test-owner-declaration",
            "migration_runner": "test-migration-runner",
        },
    )

    assert report["status"] == "TECHNICAL_CHECKS_PASSED_OWNER_ATTESTATION_REQUIRED"
    assert report["production_authorized"] is False
    assert report["owner_attestation"] == "DECLARED_UNVERIFIED"
    assert all(report["checks"].values())
    assert report["tables"]["runtime_deployments"]["resolved_name"]
    assert report["tables"]["fortress_audit_events"]["resolved_name"]
    assert report["database"]["fingerprint"]
    assert "DATABASE_URL" not in str(report)

    with psycopg.connect(DATABASE_URL) as conn:
        after = conn.execute("SELECT count(*) FROM fortress_audit_events").fetchone()[0]
    assert after == before


@pytest.mark.skipif(not DATABASE_URL, reason="requires disposable DEPLOY_TEST_DATABASE_URL")
def test_preflight_keeps_missing_owner_declarations_blocked():
    import psycopg

    from database_preflight import inspect_runtime_database

    report = inspect_runtime_database(lambda: psycopg.connect(DATABASE_URL), {})
    assert report["status"] == "TECHNICAL_CHECKS_PASSED_OWNER_ATTESTATION_REQUIRED"
    assert report["owner_attestation"] == "MISSING"
    assert report["production_authorized"] is False
