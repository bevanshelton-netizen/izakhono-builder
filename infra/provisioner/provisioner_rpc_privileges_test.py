"""Disposable-PostgreSQL regression for the internal Provisioner worker RPC grants."""
from __future__ import annotations

import os
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "supabase" / "migrations" / "20261122180000_harden_provisioner_worker_rpc_privileges.sql"


def main() -> None:
    dsn = os.environ["PROVISIONER_TEST_DSN"]
    if not MIGRATION.is_file():
        raise AssertionError(f"migration missing: {MIGRATION}")

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            for role in ("anon", "authenticated", "service_role"):
                cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (role,))
                if cur.fetchone() is None:
                    cur.execute(f"CREATE ROLE {role} NOLOGIN")

            # Reproduce Supabase-style default function grants in this disposable DB.
            cur.execute(
                "ALTER DEFAULT PRIVILEGES IN SCHEMA public "
                "GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role"
            )
            cur.execute(
                """
                CREATE OR REPLACE FUNCTION public.provisioner_run_once(p_max_steps integer DEFAULT 8)
                RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('ok', true) $$
                """
            )
            cur.execute(
                """
                SELECT has_function_privilege('anon', 'public.provisioner_run_once(integer)', 'EXECUTE'),
                       has_function_privilege('authenticated', 'public.provisioner_run_once(integer)', 'EXECUTE'),
                       has_function_privilege('service_role', 'public.provisioner_run_once(integer)', 'EXECUTE')
                """
            )
            before = cur.fetchone()
            assert before == (True, True, True), before

            cur.execute(MIGRATION.read_text(encoding="utf-8"))
            cur.execute(
                """
                SELECT has_function_privilege('anon', 'public.provisioner_run_once(integer)', 'EXECUTE'),
                       has_function_privilege('authenticated', 'public.provisioner_run_once(integer)', 'EXECUTE'),
                       has_function_privilege('service_role', 'public.provisioner_run_once(integer)', 'EXECUTE')
                """
            )
            after = cur.fetchone()
            assert after == (False, False, True), after

            cur.execute(
                """
                SELECT proconfig
                FROM pg_proc
                WHERE oid = 'public.provisioner_run_once(integer)'::regprocedure
                """
            )
            config = cur.fetchone()[0] or []
            assert "search_path=pg_catalog, public" in config, config

    print("PROVISIONER_RPC_PRIVILEGES: PASS")


if __name__ == "__main__":
    main()
