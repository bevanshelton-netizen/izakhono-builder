# IZAKHONO BUILDER

Visual, free-first application factory for IZAKHONO projects.

## What it does

- register new apps
- choose reusable product modules
- generate build recipes
- track build/deploy status
- protect owner operations with a server-side secret
- generate repository-ready Worker applications with CI and isolated-preview workflows
- commit validated generated source into owner-controlled **IZAKHONO internal repositories**
- optionally mirror validated generated apps into new private GitHub repositories through server-side automation
- deploy on Cloudflare's free-first stack
- reuse one central **IZAKHONO Build to Alpha** gate across Docker-capable projects

## IZAKHONO Internal Repositories v1

The primary source of truth for a validated generated application is now inside IZAKHONO BUILDER, not GitHub.

After generated-source validation passes, IZAKHONO canonicalizes the file set, computes a SHA-256 content hash and commits an immutable private snapshot with its parent commit recorded. An identical file set reuses the existing content commit rather than creating fake history. Repository metadata and source snapshots are stored in D1 using the checked-in `0002_internal_repositories.sql` schema, with safe lazy schema creation so first use does not depend on a manual migration click.

GitHub is therefore an optional mirror/export target rather than the owner of the Builder's source history.

See `docs/INTERNAL-REPOSITORIES-V1.md`.

## Repository Autopilot v1

Generated Worker applications leave the factory as repository-ready packages rather than loose source files. Each bundle includes least-privilege CI, a credential-gated isolated-preview workflow, private-by-default repository metadata, local-secret exclusions and a versioned Builder technical preview.

When the Builder runtime has the optional server-side GitHub automation credential, it can mirror a validated generated bundle into a new private GitHub repository. It refuses to overwrite an existing repository, and provider preview credentials are never generated into source.

See `docs/REPOSITORY-AUTOPILOT-V1.md`.

## Fast Build v0.2

The reusable Alpha gate lives at `.github/workflows/izakhono-build-to-alpha.yml`.

A target repository supplies a small `.izakhono.json` contract and the caller workflow from `templates/call-izakhono-alpha.yml`. IZAKHONO then validates safe repository paths, builds the declared Docker application, labels the image with product and Git provenance, starts it, and requires its HTTP health gate to pass.

The caller template pins the central policy to an **immutable reviewed commit SHA** rather than a moving branch such as `main`. Policy upgrades therefore require an explicit reviewed pin change instead of silently changing existing project trust boundaries.

Projects may also opt into reviewed project-specific Alpha rehearsal and Windows packaging using fixed script paths. The Owner interface does **not** accept arbitrary shell commands.

See `docs/FAST-BUILD-V0.2.md` and `templates/izakhono.manifest.example.json`.

## Safety and readiness

- no production secrets committed to source control
- no arbitrary Owner-mode shell execution
- internal repository visibility is private-only
- validated source snapshots are content-addressed and retain parent history
- external repository publication defaults to private and refuses overwrite
- generated provider previews use `pull_request`, never `pull_request_target`
- immutable policy pins for generated/copyable Alpha caller workflows
- failed health or internal-repository gates are not promoted
- artifact retention is convenience, not proof of software correctness
- CI validation is not a substitute for real public hosting, DNS/TLS, disaster recovery, physical-device testing, code signing, external security review, privacy/legal approval or customer acceptance

## Cost principle

Use free-first infrastructure where practical, but do not pretend compute and platform quotas are unlimited. Upgrade only when demand, revenue, compliance or a hard technical requirement justifies it.
