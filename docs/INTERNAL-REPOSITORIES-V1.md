# IZAKHONO Internal Repositories v1

IZAKHONO BUILDER now treats its own private repository history as the primary source of truth for validated generated applications. External GitHub repositories remain optional mirrors.

## Commit rule

A generated bundle is committed internally only after the deterministic generated-source validation gate passes.

The repository layer:

- canonicalizes generated files by sorted path;
- computes a SHA-256 content hash;
- derives an immutable `izc_...` commit identifier from that content;
- records the previous head as the parent commit;
- reuses an existing commit if the exact generated file set was already committed;
- stores visibility as `private` only.

A failed internal repository commit prevents the project from remaining promoted as validated. The project returns to `building` with a repair gate rather than silently claiming repository ownership succeeded.

## Storage

D1 stores repository metadata and immutable source snapshots in:

- `builder_internal_repositories`
- `builder_internal_repo_commits`

Migration `0002_internal_repositories.sql` defines the durable schema. The Worker also uses `CREATE TABLE IF NOT EXISTS` before repository operations so deployment does not depend on a separate manual migration click before the first validated commit. The checked-in migration remains the reproducible schema source for normal operations and future hosts.

## Owner API

Owner-authenticated routes:

- `GET /api/projects/<project-id>/internal-repository` — repository metadata and commit history
- `GET /api/projects/<project-id>/internal-repository/head` — current head commit with files
- `GET /api/projects/<project-id>/internal-repository/<commit-id>` — exact immutable commit with files

The Owner UI exposes repository history without asking for provider credentials.

## External mirrors

GitHub publication remains available through Repository Autopilot when the runtime has its server-side GitHub automation credential. That external repository is a mirror/export target, not the authoritative IZAKHONO repository.

The internal repository has no dependency on GitHub, Cloudflare API tokens, Vercel, Netlify or another source-control provider.

## Current boundary

This provides owner-controlled application source history inside IZAKHONO BUILDER. It is not yet a complete replacement for every Git feature such as arbitrary branches, multi-user merge review, signed commits, distributed clone/fetch protocols or large binary object storage. Those can be layered on top without giving external providers ownership of the source of truth.
