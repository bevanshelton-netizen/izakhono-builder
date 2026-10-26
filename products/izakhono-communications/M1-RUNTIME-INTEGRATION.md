# M1 Native PostgreSQL Runtime Integration Gate

## Objective
Move the communications control plane from the development memory repository to the intended IZAKHONO-owned PostgreSQL runtime without coupling the application to a specific database driver.

## Required runtime configuration

- `IZAKHONO_DATABASE_URL` — secret PostgreSQL connection string supplied only by the runtime secret manager.
- `IZAKHONO_COMMUNICATIONS_REPOSITORY=postgres` — explicit production repository selection.
- TLS verification enabled for non-local database connections.

No credentials belong in source control, tests, logs, or client bundles.

## Migration gate

Apply `M1-DATA-MODEL.sql` once against the target PostgreSQL database. The migration must be executed by a controlled deployment/migration process, not by every application startup.

## Verification gate

Before selecting the PostgreSQL repository in production, verify:

1. Database connection succeeds using runtime-injected credentials.
2. Schema objects exist, including `provisioning_jobs`.
3. Create → read → idempotent duplicate → update → tenant-isolation operations pass.
4. A failed provisioning step can be resumed without creating duplicate resources.
5. Database errors are returned as controlled service errors and do not expose credentials or SQL details.
6. Backups and restore procedures are documented and tested on the target runtime.

## Current status

The repository adapter is implemented at source level. Runtime connection, migration execution, backup/restore, and production acceptance are **not verified by this repository change alone**.

## Next gate

After runtime PostgreSQL verification, integrate the first real carrier/SIP adapter behind the existing carrier abstraction and verify inbound and outbound call paths on an IZAKHONO-owned runtime node.
