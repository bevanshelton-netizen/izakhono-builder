# CONNECTA — PUBLIC PRODUCTION LAUNCH GATE

## Purpose

This is the final operator runbook for promoting CONNECTA from **BUILT / NOT YET PUBLIC** to a verified public release. CONNECTA uses a provider-neutral logical software runtime; no particular physical server or hardware identity is a release prerequisite.

## Required sequence

1. Confirm the source release is immutable and record its exact 40-character Git SHA.
2. Select and approve the logical runtime identity and runtime provider. Do not encode a physical machine name as the runtime identity.
3. Execute the CONNECTA software-runtime deployment procedure for that exact SHA.
4. Confirm the runtime reports:
   - approved runtime identity/provider;
   - immutable CONNECTA deployment succeeded;
   - `/health` returned success;
   - registration/login and application persistence smoke tests passed;
   - PostgreSQL/media backup completed;
   - non-destructive restore test completed.
5. Execute controlled failover and failback using the same immutable release.
6. Verify security controls, secret handling, private database/admin ports and required security checks.
7. Configure FORTRESS/EDGE/TLS for the approved CONNECTA hostname.
8. Point only the approved DNS record to the verified EDGE endpoint, under the authorised change process.
9. From a network outside the runtime, verify:
   - HTTPS certificate and hostname correctness;
   - `GET /health` returns HTTP 200;
   - registration and login work;
   - feed and persistence work;
   - community/post/reply actions persist;
   - direct messaging works;
   - logout clears the session.
10. Run the fail-closed production evidence gate and retain its report.
11. Only after every gate passes, update `.izakhono.json` to the verified production state.

## Hard stop rules

Do **not** declare CONNECTA public if any of the following is unverified:

- approved runtime identity/provider and immutable release;
- application deployment and local health;
- PostgreSQL/media backup and restore proof;
- failover/failback;
- security;
- FORTRESS/EDGE/TLS;
- approved DNS;
- independent external HTTPS;
- rollback capability.

## Ownership rule

The canonical route is:

`IZAKHONO CODE -> APPROVED SOFTWARE RUNTIME -> PostgreSQL + CONNECTA ENGINE + CONNECTA Web -> FORTRESS -> EDGE/TLS -> IZAKHONO DNS`

Owned infrastructure is preferred. Approved external infrastructure is a reversible resilience/fallback route and must not silently become the production authority.

## Current state

**NOT YET PUBLIC — awaiting approved runtime execution and independent recovery, security, EDGE/TLS, DNS and HTTPS evidence.**
