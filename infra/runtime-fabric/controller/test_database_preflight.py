"""Disposable PostgreSQL tests for the read-only Runtime Fabric binding preflight."""

from __future__ import annotations

import os

import pytest

DATABASE_URL = os.getenv("DEPLOY_TEST_DATABASE_URL")


def runtime_role_dsn():
    import psycopg
    from psycopg.conninfo import make_conninfo

    role = "deploy_preflight_runtime"
    password = "ci-only-runtime-role-password"
    with psycopg.connect(DATABASE_URL, autocommit=True) as owner:
        owner.execute(
            """
            DO $$
            BEGIN
              IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'deploy_preflight_runtime') THEN
                EXECUTE 'CREATE ROLE deploy_preflight_runtime LOGIN PASSWORD ''ci-only-runtime-role-password''';
              ELSE
                EXECUTE 'ALTER ROLE deploy_preflight_runtime WITH LOGIN PASSWORD ''ci-only-runtime-role-password''';
              END IF;
            END
            $$;
            """
        )
        owner.execute("GRANT CONNECT ON DATABASE deploy_control_test TO deploy_preflight_runtime")
        owner.execute("GRANT USAGE ON SCHEMA public TO deploy_preflight_runtime")
        owner.execute("REVOKE ALL PRIVILEGES ON TABLE izakhono_runtime_deployments FROM deploy_preflight_runtime")
        owner.execute("REVOKE ALL PRIVILEGES ON TABLE fortress_audit_events FROM deploy_preflight_runtime")
        owner.execute("REVOKE ALL PRIVILEGES ON TABLE izakhono_runtime_schema_migrations FROM deploy_preflight_runtime")
        owner.execute("GRANT SELECT, INSERT, UPDATE ON TABLE izakhono_runtime_deployments TO deploy_preflight_runtime")
        owner.execute("GRANT SELECT, INSERT ON TABLE fortress_audit_events TO deploy_preflight_runtime")
        owner.execute("GRANT SELECT ON TABLE izakhono_runtime_schema_migrations TO deploy_preflight_runtime")
    return make_conninfo(DATABASE_URL, user=role, password=password)


@pytest.mark.skipif(not DATABASE_URL, reason="requires disposable DEPLOY_TEST_DATABASE_URL")
def test_preflight_checks_both_stores_read_only_and_never_authorizes_production():
    import psycopg

    from database_preflight import inspect_runtime_database

    with psycopg.connect(DATABASE_URL) as conn:
        before = conn.execute("SELECT count(*) FROM fortress_audit_events").fetchone()[0]

    runtime_dsn = runtime_role_dsn()
    report = inspect_runtime_database(
        lambda: psycopg.connect(runtime_dsn),
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
    assert report["checks"]["runtime_role_is_not_table_owner"]
    assert report["checks"]["fortress_audit_select_insert_only"]
    assert report["checks"]["fortress_audit_append_only_trigger"]
    assert report["database"]["role"] == "deploy_preflight_runtime"
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

    runtime_dsn = runtime_role_dsn()
    report = inspect_runtime_database(lambda: psycopg.connect(runtime_dsn), {})
    assert report["status"] == "TECHNICAL_CHECKS_PASSED_OWNER_ATTESTATION_REQUIRED"
    assert report["owner_attestation"] == "MISSING"
    assert report["production_authorized"] is False


@pytest.mark.skipif(not DATABASE_URL, reason="requires ephemeral DEPLOY_TEST_DATABASE_URL")
def test_preflight_blocks_runtime_role_with_audit_mutation_privilege():
    import psycopg

    from database_preflight import inspect_runtime_database

    runtime_dsn = runtime_role_dsn()
    with psycopg.connect(DATABASE_URL, autocommit=True) as owner:
        owner.execute("GRANT UPDATE ON TABLE fortress_audit_events TO deploy_preflight_runtime")

    report = inspect_runtime_database(lambda: psycopg.connect(runtime_dsn), {})
    assert report["checks"]["runtime_role_is_not_table_owner"]
    assert not report["checks"]["fortress_audit_select_insert_only"]
    assert report["checks"]["fortress_audit_append_only_trigger"]
    assert report["status"] == "BLOCKED_TECHNICAL"

    with psycopg.connect(DATABASE_URL, autocommit=True) as owner:
        owner.execute("REVOKE UPDATE ON TABLE fortress_audit_events FROM deploy_preflight_runtime")


@pytest.mark.skipif(not DATABASE_URL, reason="requires ephemeral DEPLOY_TEST_DATABASE_URL")
def test_preflight_rejects_table_owner_as_runtime_identity():
    import psycopg

    from database_preflight import inspect_runtime_database

    report = inspect_runtime_database(lambda: psycopg.connect(DATABASE_URL), {})
    assert not report["checks"]["runtime_role_is_not_table_owner"]
    assert not report["checks"]["fortress_audit_select_insert_only"]
    assert report["status"] == "BLOCKED_TECHNICAL"
