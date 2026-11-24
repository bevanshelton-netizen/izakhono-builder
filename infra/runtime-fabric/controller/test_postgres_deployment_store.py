"""Real PostgreSQL regression for DEPLOY metadata preservation in Runtime Fabric."""

from __future__ import annotations

import json
import os

import pytest

DATABASE_URL = os.getenv("DEPLOY_TEST_DATABASE_URL")


@pytest.mark.skipif(not DATABASE_URL, reason="requires ephemeral DEPLOY_TEST_DATABASE_URL")
def test_runtime_store_put_preserves_reserved_deploy_control_metadata():
    import psycopg

    from deployment_state import DeploymentRecord
    from postgres_deployment_store import PostgresDeploymentStore

    with psycopg.connect(DATABASE_URL) as admin:
        admin.execute("DROP SCHEMA IF EXISTS deploy_test CASCADE")
        admin.execute("CREATE SCHEMA deploy_test")

    options = "-c search_path=deploy_test,public"

    try:
        with psycopg.connect(DATABASE_URL, options=options) as conn:
            conn.execute(
                """
                CREATE TABLE izakhono_runtime_deployments (
                    deployment_id TEXT PRIMARY KEY,
                    workload TEXT NOT NULL,
                    state TEXT NOT NULL,
                    node TEXT,
                    checkpoint TEXT,
                    attempts INTEGER NOT NULL DEFAULT 0,
                    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            deploy_control = {
                "record": {"deployment_id": "dep-preserve", "state": "VALIDATED"},
                "idempotency": {"key-hash": {"request_hash": "a" * 64, "response": {"state": "VALIDATED"}}},
            }
            metadata = {
                "tenant_id": "tenant-1",
                "application_id": "app-1",
                "environment_id": "staging",
                "deploy_control": deploy_control,
            }
            conn.execute(
                """
                INSERT INTO izakhono_runtime_deployments
                    (deployment_id, workload, state, metadata)
                VALUES (%s, %s, %s, %s::jsonb)
                """,
                ("dep-preserve", "web-application", "CREATED", json.dumps(metadata)),
            )

        def connect():
            return psycopg.connect(DATABASE_URL, options=options)

        store = PostgresDeploymentStore(connect)
        store.put(
            DeploymentRecord(
                deployment_id="dep-preserve",
                workload="web-application",
                state="HEALTH_CHECKING",
                metadata={"runtime_marker": "updated"},
            )
        )

        with psycopg.connect(DATABASE_URL, options=options) as conn:
            row = conn.execute(
                "SELECT metadata FROM izakhono_runtime_deployments WHERE deployment_id = %s",
                ("dep-preserve",),
            ).fetchone()
        assert row is not None
        assert row[0]["runtime_marker"] == "updated"
        assert row[0]["deploy_control"] == deploy_control
        assert row[0]["tenant_id"] == "tenant-1"
        assert row[0]["application_id"] == "app-1"
        assert row[0]["environment_id"] == "staging"
    finally:
        with psycopg.connect(DATABASE_URL) as admin:
            admin.execute("DROP SCHEMA IF EXISTS deploy_test CASCADE")
