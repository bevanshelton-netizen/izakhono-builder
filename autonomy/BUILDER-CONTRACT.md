# IZAKHONO Builder Contract v2

## Objective

IZAKHONO BUILDER is the sovereign, credits-free application factory. It turns an authorized project brief into a deterministic, multi-file application scaffold, validates and tests the result, stores a content-addressed snapshot, and prepares a release candidate only when its evidence gates pass.

## Execution loop

`OBJECTIVE → PLAN → TEMPLATE → GENERATE → TEST → SECURITY → SNAPSHOT → RELEASE CANDIDATE`

The control plane may advance automatically whenever dependencies and evidence are satisfied.

## Native execution

- `izakhono-native` is the sole built-in Builder execution provider.
- Standard templates are versioned and deterministic.
- Ollama-compatible local inference is an optional adapter for supported text/reasoning/code tasks.
- The default inference endpoint is loopback. Explicitly configured endpoints must remain private or loopback.
- If the local runtime is unavailable, deterministic templates and native rules remain usable. The Builder must not rotate to a hosted inference provider.
- No Hercules endpoint, account, external AI credit, per-prompt fee, or artificial usage meter is permitted.

## Generated application contract

Every generated application must contain a manifest, package metadata, executable source, tests, and operator documentation. Template paths are validated, generated text is HTML-escaped before insertion into HTML, and generated code is syntax-checked. Owner-mode shell execution is not available to generated projects.

## Internal repository snapshots

A canonical snapshot sorts normalized relative paths, hashes each file with SHA-256, and hashes the ordered path/hash manifest. Content-addressed objects and snapshot manifests are immutable and idempotent. Snapshot identity must not depend on timestamps, filesystem enumeration order, locale, or host machine identity.

## Evidence and release

A generated application is not production-ready merely because files exist. Required evidence includes successful scaffold validation, syntax checks, application tests, FORTRESS security checks, deployment/DNS/TLS evidence where applicable, backup/restore evidence, and end-to-end acceptance. Public-live status remains false until the full production evidence set is recorded.

## Owner gates

Credentials, financial authorization, security exceptions, DNS changes, production deployment, and other consequential external side effects require their explicit authorization gates. A blocked side effect must not prevent independent local build and test work.
