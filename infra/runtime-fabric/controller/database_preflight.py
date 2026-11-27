#!/usr/bin/env python3
"""Read-only Runtime Fabric/FORTRESS database binding preflight.

This utility never creates or changes schema/data. It checks both required
stores through one read-only PostgreSQL connection and deliberately never
claims owner authority or production authorization.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from typing import Any, Callable


REQUIRED_COLUMNS = {
    "izakhono_runtime_deployments": {
        "deployment_id", "workload", "state", "metadata", "tenant_id",
        "application_id", "environment_id", "updated_at",
    },
    "izakhono_deploy_audit_events": {
        "event_id", "deployment_id", "tenant_id", "operation_id", "event_type",
        "actor", "adapter", "state", "observed_at", "data",
    },
    "izakhono_runtime_schema_migrations": {
        "migration_id", "checksum_sha256", "applied_at", "applied_by",
        "approval_id", "change_reference", "rollback_reference",
    },
}


def inspect_runtime_database(
    connection_factory: Callable[[], Any],
    declarations: dict[str, str | None] | None = None,
) -> dict[str, Any]:
    """Inspect both stores in one read-only transaction; never expose a DSN."""
    declarations = declarations or {}
    conn = connection_factory()
    try:
        with conn.cursor() as cur:
            cur.execute("BEGIN READ ONLY")
            cur.execute(
                """
                SELECT current_database(), current_user,
                       COALESCE(inet_server_addr()::text, 'local-socket'),
                       current_setting('server_version'),
                       current_setting('transaction_read_only'),
                       to_regclass('izakhono_runtime_deployments')::text,
                       to_regclass('izakhono_deploy_audit_events')::text,
                       to_regclass('izakhono_runtime_schema_migrations')::text
                """
            )
            identity = cur.fetchone()
            database_name, database_role, server_address, server_version, read_only, runtime_reg, fortress_reg, migration_reg = identity

            cur.execute(
                """
                SELECT c.relname, n.nspname, a.attname,
                       format_type(a.atttypid, a.atttypmod)
                  FROM pg_class c
                  JOIN pg_namespace n ON n.oid = c.relnamespace
                  JOIN pg_attribute a ON a.attrelid = c.oid
                 WHERE c.oid IN (
                     to_regclass('izakhono_runtime_deployments'),
                     to_regclass('izakhono_deploy_audit_events'),
                     to_regclass('izakhono_runtime_schema_migrations')
                 )
                   AND a.attnum > 0
                   AND NOT a.attisdropped
                """
            )
            columns: dict[str, set[str]] = {name: set() for name in REQUIRED_COLUMNS}
            column_types: dict[tuple[str, str], str] = {}
            table_schemas: dict[str, str] = {}
            for table_name, schema_name, column_name, data_type in cur.fetchall():
                if table_name in columns:
                    columns[table_name].add(column_name)
                    column_types[(table_name, column_name)] = data_type
                    table_schemas[table_name] = schema_name

            role_info = None
            migration_row = None
            if runtime_reg and fortress_reg and migration_reg:
                cur.execute(
                    """
                    SELECT pg_get_userbyid(runtime.relowner),
                           pg_get_userbyid(audit.relowner),
                           pg_get_userbyid(ledger.relowner),
                           has_table_privilege(current_user, runtime.oid, 'SELECT'),
                           has_table_privilege(current_user, runtime.oid, 'INSERT'),
                           has_table_privilege(current_user, runtime.oid, 'UPDATE'),
                           has_table_privilege(current_user, audit.oid, 'SELECT'),
                           has_table_privilege(current_user, audit.oid, 'INSERT'),
                           has_table_privilege(current_user, audit.oid, 'UPDATE'),
                           has_table_privilege(current_user, audit.oid, 'DELETE'),
                           has_table_privilege(current_user, audit.oid, 'TRUNCATE'),
                           has_table_privilege(current_user, ledger.oid, 'SELECT'),
                           EXISTS (
                               SELECT 1 FROM pg_trigger t
                                WHERE t.tgrelid = audit.oid
                                  AND t.tgname = 'izakhono_deploy_audit_no_mutation'
                                  AND t.tgenabled IN ('O', 'A')
                                  AND NOT t.tgisinternal
                           )
                      FROM pg_class runtime
                      CROSS JOIN pg_class audit
                      CROSS JOIN pg_class ledger
                     WHERE runtime.oid = to_regclass('izakhono_runtime_deployments')
                       AND audit.oid = to_regclass('izakhono_deploy_audit_events')
                       AND ledger.oid = to_regclass('izakhono_runtime_schema_migrations')
                    """
                )
                role_info = cur.fetchone()
                cur.execute(
                    "SELECT checksum_sha256 FROM izakhono_runtime_schema_migrations " 
                    "WHERE migration_id = %s",
                    ("0001_runtime_fabric_deploy",),
                )
                migration_row = cur.fetchone()
            cur.execute("ROLLBACK")

        required_columns_present = all(
            required.issubset(columns.get(table, set()))
            for table, required in REQUIRED_COLUMNS.items()
        )
        jsonb_contract = (
            column_types.get(("izakhono_runtime_deployments", "metadata")) == "jsonb"
            and column_types.get(("izakhono_deploy_audit_events", "data")) == "jsonb"
        )
        runtime_owner = role_info[0] if role_info else None
        deploy_audit_owner = role_info[1] if role_info else None
        migration_owner = role_info[2] if role_info else None
        runtime_permissions = role_info[3:6] if role_info else (False, False, False)
        audit_permissions = role_info[6:11] if role_info else (False, False, False, False, False)
        migration_ledger_select = bool(role_info[11]) if role_info else False
        append_only_trigger = bool(role_info[12]) if role_info else False
        migration_path = Path(__file__).resolve().parents[3] / "deploy-control" / "migrations" / "0001_runtime_fabric_deploy.sql"
        expected_migration_sha256 = hashlib.sha256(migration_path.read_bytes()).hexdigest() if migration_path.is_file() else ""
        migration_checksum_match = bool(
            migration_row and str(migration_row[0]).strip() == expected_migration_sha256
        )
        checks = {
            "read_only_transaction": read_only == "on",
            "runtime_deployment_table_present": bool(runtime_reg),
            "fortress_audit_table_present": bool(fortress_reg),
            "migration_ledger_table_present": bool(migration_reg),
            "required_columns_present": required_columns_present,
            "jsonb_contract": jsonb_contract,
            "same_database_connection": bool(runtime_reg and fortress_reg and migration_reg),
            "runtime_role_is_not_table_owner": bool(role_info and database_role not in (runtime_owner, deploy_audit_owner, migration_owner)),
            "runtime_deployment_select_insert_update": all(runtime_permissions),
            "fortress_audit_select_insert_only": (
                audit_permissions[0] and audit_permissions[1] and not any(audit_permissions[2:])
            ),
            "fortress_audit_append_only_trigger": append_only_trigger,
            "migration_ledger_select": migration_ledger_select,
            "migration_checksum_matches_reviewed_source": migration_checksum_match,
        }
        technical_pass = all(checks.values())
        declared = {
            "database_id": declarations.get("database_id") or "",
            "environment": declarations.get("environment") or "",
            "owner": declarations.get("owner") or "",
            "migration_runner": declarations.get("migration_runner") or "",
        }
        declarations_complete = all(bool(value.strip()) for value in declared.values())
        fingerprint_material = "|".join(
            [str(database_name), str(server_address), str(server_version)]
        )
        fingerprint = hashlib.sha256(fingerprint_material.encode("utf-8")).hexdigest()
        return {
            "status": (
                "TECHNICAL_CHECKS_PASSED_OWNER_ATTESTATION_REQUIRED"
                if technical_pass else "BLOCKED_TECHNICAL"
            ),
            "production_authorized": False,
            "database": {
                "name": database_name,
                "role": database_role,
                "server_version": server_version,
                "fingerprint": fingerprint,
            },
            "table_owners": {
                "runtime_deployments": runtime_owner,
                "izakhono_deploy_audit_events": deploy_audit_owner,
                "izakhono_runtime_schema_migrations": migration_owner,
            },
            "tables": {
                "runtime_deployments": {
                    "resolved_name": runtime_reg,
                    "schema": table_schemas.get("izakhono_runtime_deployments"),
                    "columns": sorted(columns["izakhono_runtime_deployments"]),
                },
                "izakhono_deploy_audit_events": {
                    "resolved_name": fortress_reg,
                    "schema": table_schemas.get("izakhono_deploy_audit_events"),
                    "columns": sorted(columns["izakhono_deploy_audit_events"]),
                },
            },
            "checks": checks,
            "owner_declarations": declared,
            "owner_attestation": "DECLARED_UNVERIFIED" if declarations_complete else "MISSING",
            "limitations": [
                "A successful connection does not prove who owns or controls the database.",
                "Environment and owner values are declarations, not independently verified authority.",
                "This preflight does not verify production DSN provenance, legal database ownership, migration authority, backups, or every row-level security policy.",
                "The runtime role must still be explicitly attested by the database owner; technical privilege checks do not confer production authority.",
                "No write, DDL, migration, grant, policy, or production action is performed.",
            ],
        }
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()


def main() -> int:
    dsn = os.environ.get("IZAKHONO_RUNTIME_DATABASE_URL")
    if not dsn:
        print(json.dumps({
            "status": "BLOCKED_CONFIGURATION",
            "production_authorized": False,
            "error": "IZAKHONO_RUNTIME_DATABASE_URL is not configured in the operator environment.",
        }, indent=2))
        return 2

    try:
        import psycopg

        report = inspect_runtime_database(
            lambda: psycopg.connect(dsn),
            {
                "database_id": os.environ.get("IZAKHONO_RUNTIME_DATABASE_ID"),
                "environment": os.environ.get("IZAKHONO_RUNTIME_DATABASE_ENV"),
                "owner": os.environ.get("IZAKHONO_RUNTIME_DATABASE_OWNER"),
                "migration_runner": os.environ.get("IZAKHONO_RUNTIME_MIGRATION_RUNNER"),
            },
        )
    except Exception as exc:
        # Do not print exception messages: drivers may include connection details.
        print(json.dumps({
            "status": "BLOCKED_CONNECTION_OR_INSPECTION",
            "production_authorized": False,
            "error_type": type(exc).__name__,
        }, indent=2))
        return 2

    print(json.dumps(report, indent=2, sort_keys=True))
    return 0 if report["status"] == "TECHNICAL_CHECKS_PASSED_OWNER_ATTESTATION_REQUIRED" else 2


if __name__ == "__main__":
    raise SystemExit(main())
