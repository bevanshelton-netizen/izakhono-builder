# IZAKHONO COMPUTER — Product Contract

## Promise

A user should be able to open an IZAKHONO client on another device and continue working with the same workspace, applications, files, AI context and active jobs.

## Device independence

A phone, tablet, laptop or desktop is treated as an access device. The software-defined computer is the NODE01 session.

## Required services

1. Identity/session service
2. Workspace service
3. Virtual filesystem
4. Application registry
5. Compute scheduler
6. Isolated job runner
7. AI gateway
8. Snapshot/restore
9. Sync/cache engine
10. Secure communications adapters
11. Observability/audit

## Failure behaviour

If one compute provider disappears, the session must enter a recoverable state and attempt another approved provider. User data must not be coupled to the lifecycle of a compute worker.

## Safety boundaries

The system must never expose unrestricted host access merely because a user owns a session. Privileged operations require explicit capability checks and isolated execution.

## Success criterion

A user can lose the original computer and resume their work from another supported device without losing the workspace state, subject to the availability of the configured storage and compute providers.
