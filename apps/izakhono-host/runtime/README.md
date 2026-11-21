# IZAKHONO HOST Native Runtime v1

This runtime layer turns the HOST control plane into an owned-first execution boundary.

## Components

- `worker.js` — deterministic build-job worker with isolated job directories, bounded execution time and deployment receipts.
- `artifact-store.js` — content-addressed local artifact storage using SHA-256.
- `runtime-manifest.json` — runtime gates and ownership contract.

## Execution model

HOST accepts a deployment -> worker claims the job -> source is materialized into a temporary workspace -> build command executes with a clean environment boundary -> output is hashed and stored -> deployment receipt is written.

The runtime deliberately does not claim public production serving. Serving, TLS, DNS, multi-NODE scheduling and backup/restore remain explicit promotion gates.

## Safety

- no shell interpolation of repository/job identifiers
- bounded build timeout
- per-job temporary workspace
- only declared build command is executed
- artifacts are immutable by digest
- failed builds do not become promotable deployments
