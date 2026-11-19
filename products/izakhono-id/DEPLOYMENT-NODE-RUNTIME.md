# IZAKHONO ID — NODE runtime deployment package

**Service:** `izakhono-id.service`  
**Logical runtime identity:** NODE01 (software identity; not a physical host)  
**Process:** `products/izakhono-id/app.py`  
**Listener:** `127.0.0.1:9696` (private loopback only)  
**State:** `/var/lib/izakhono-id` (persistent SQLite state; mode 0700)  
**Environment file:** `/etc/izakhono/id.env` (root-owned, mode 0600)

## Safety boundary

This package prepares the service for a future approved persistent runtime. It does not provision a host, create a NODE01 physical machine, configure DNS/TLS, expose a public port, or deploy the service. NODE01 remains a logical IZAKHONO software/runtime identity. A separately approved runtime binding must identify the actual execution environment.

Do not run the installation steps on an unverified host. Do not put ADMIN or INTERNAL keys in source control, shell history, chat, or this document. Provision them through the host's protected secret/configuration channel.

## Runtime prerequisites

- Approved, owner-controlled execution environment with private networking and durable encrypted storage.
- Supported Python 3 runtime and OS security updates.
- Dedicated `izakhono` system user/group with no interactive login.
- `/opt/izakhono-id` populated from the reviewed immutable release artifact.
- `/etc/izakhono/id.env` created by an authorised operator, root-owned and mode 0600.
- Persistent backup destination outside the service state directory, with encryption and access logging.
- Private reverse proxy / service mesh for HTTPS termination and upstream access control. The Python process itself remains bound to loopback.

## Required protected environment variables

Set values only through the approved secret-management process:

- `IZAKHONO_ID_ADMIN_KEY` — high-entropy owner-controlled administrative credential.
- `IZAKHONO_ID_INTERNAL_KEY` — independent high-entropy service-to-service introspection credential.
- `IZAKHONO_ID_MFA_MASTER_KEY` — at least 32 characters; protect and back up under controlled key custody.
- `IZAKHONO_ID_REQUIRE_EMAIL_VERIFICATION=true`.
- SMTP/recovery configuration only when the owner-approved email workflow is ready.

Never disable email verification or MFA controls to make deployment pass. Internal/admin credentials must be distinct and have rotation/recovery procedures.

## Installation and activation (future approved runtime only)

1. Verify the host/runtime binding, owner access, OS baseline, encrypted volume, backup destination and restore procedure.
2. Install the reviewed application artifact under `/opt/izakhono-id`; verify its immutable commit/artifact hash.
3. Create the dedicated service user/group and protected environment file.
4. Install `izakhono-id.service` to `/etc/systemd/system/`.
5. Run `systemd-analyze verify /etc/systemd/system/izakhono-id.service`.
6. Enable/start only after an approved change record and rollback package exist:
   `systemctl enable --now izakhono-id.service`.
7. Verify locally: `curl --fail http://127.0.0.1:9696/healthz`. Health output is not proof of external HTTPS readiness.
8. Configure HTTPS ingress separately with a verified certificate, strict host allowlist, request limits, access logs and private upstream policy. Never expose port 9696 directly to the public internet.
9. Verify `POST /api/v1/internal/introspect` only from an authorised private caller using the protected internal key; test active, revoked, expired and inactive membership cases.
10. Complete backup/restore, restart, disk-full, process-crash and key-rotation tests before marking the runtime ready.

## Persistence and backup requirements

The SQLite database must remain at `/var/lib/izakhono-id/identity.db` on durable storage. Do not run this service on ephemeral serverless filesystems or an ephemeral container layer.

Use SQLite's online backup API or a transactionally consistent snapshot. Encrypt backups before transfer/storage, restrict access to owner-authorised operators, retain integrity hashes, and perform a restore test into an isolated environment. Do not copy a live WAL database with an uncoordinated plain file copy.

## Rollback

- Keep the prior immutable application artifact and matching configuration schema.
- Stop the service before any filesystem-level rollback.
- Preserve a verified pre-change backup; never delete or overwrite the only known-good identity database.
- Restore the previous artifact and verify local health and session introspection.
- Escalate any database migration or key rotation that could invalidate existing sessions/MFA enrollments.

## Acceptance evidence

A deployment is not accepted until there is independently collected evidence for:
- approved runtime binding and owner-only administration;
- persistent encrypted database and tested backup restore;
- hardened systemd service and loopback-only listener;
- HTTPS certificate, DNS and private ingress controls;
- active/revoked/expired/inactive entity-membership introspection tests;
- stable `user_id`, `entity_id`, `membership_id`, `session_id`, `role` and expiry claims;
- monitoring, alerting, log redaction, incident response and secret rotation;
- independent security review and rollback rehearsal.

**Current status:** prepared as source documentation only. No host was provisioned, no service installed, no secret configured, and no production endpoint exists.
