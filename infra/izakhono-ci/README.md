# IZAKHONO CI

Owned-first CI control layer for IZAKHONO infrastructure.

## Purpose

IZAKHONO CI is the repository-controlled validation layer. GitHub Actions may execute it, but the validation logic itself belongs to IZAKHONO and is designed to be runnable on NODE01 or another owned runner.

## Current gates

- source syntax and unit/contract tests
- NODE01 mail persistence and production-gate tests
- mail identity validation
- BIND DNS zone validation
- Docker Compose configuration validation
- production readiness gates must never be converted into `LIVE` without external evidence

## Design rule

CI validates software and configuration. It does not manufacture proof of public reachability. Production mail becomes LIVE only after external SMTP send, receive, reply, TLS and DNS authentication evidence is recorded by the verification layer.

## Migration path

1. Run the same gate commands on GitHub Actions.
2. Run them on NODE01 as an owned worker.
3. Store signed verification results in NODE01 observability/storage.
4. Use GitHub only as an optional external execution surface.
