# CONNECTA — NODE01 PUBLIC LAUNCH GATE

## Purpose

This is the final machine-side runbook for promoting CONNECTA from **BUILT / NOT YET PUBLIC** to a verified public release.

## Required sequence

1. Confirm the repository release commit is immutable and matches the intended `main` release.
2. Execute `RUN-CONNECTA-NODE01.sh` on NODE01.
3. Confirm the launcher reports:
   - NODE01 guardian ready
   - production environment present
   - immutable CONNECTA deployment succeeded
   - `http://127.0.0.1:3080/health` returned success
   - PostgreSQL backup completed
   - non-destructive restore test completed
4. Configure FORTRESS/EDGE/TLS for the approved CONNECTA hostname.
5. Point the approved DNS record to the verified FORTRESS/EDGE endpoint.
6. From a network outside NODE01, verify:
   - HTTPS certificate and hostname correctness
   - `GET /health` returns HTTP 200
   - registration and login work
   - feed persistence works
   - community/post/reply actions persist
   - direct messaging works
   - logout clears the session
7. Execute rollback/failback verification before declaring public production.
8. Only after all evidence exists, update `.izakhono.json` from `NOT_YET_VERIFIED` / `NOT YET PUBLIC` to the verified production state.

## Hard stop rules

Do **not** declare CONNECTA public if any of the following is unverified:

- NODE01 deployment
- PostgreSQL/media backup
- restore proof
- FORTRESS/EDGE/TLS
- DNS
- independent external HTTPS health
- rollback/failback

## Ownership rule

The canonical production route remains:

`IZAKHONO CODE -> NODE01 -> PostgreSQL + CONNECTA ENGINE + CONNECTA Web -> FORTRESS -> EDGE/TLS -> IZAKHONO DNS`

External infrastructure is resilience/fallback only and must not silently become the production authority.

## Current state

**NOT YET PUBLIC — awaiting physical NODE01 + EDGE/TLS + DNS verification.**
