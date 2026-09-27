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

## Public Studio handoff v1

The public IZAKHONO ONE Builder Studio can export an `izakhono.project.json` handoff with schema `izakhono.builder/handoff-v1`.

The Owner Builder accepts that file through `POST /api/import-handoff` or the Owner UI import control. Import is authenticated, normalises module keys against the Builder registry, adds every mandatory portfolio baseline module, creates a **planned** project and generates its build recipe. Import does not deploy or publish the application.

This keeps the public describe/preview/export experience separate from the trusted Owner build/repository/release path.

## Build Anything v1

IZAKHONO BUILDER now includes an owner-gated **one-sentence build pipeline** for apps, websites, games and software. A brief submitted to `POST /api/build-anything` is classified locally, mapped to reusable product modules, created as a Builder project, planned, generated, deterministically validated and committed into the IZAKHONO internal repository.

External publication is not triggered automatically and public-live status remains evidence-gated. When the owner-controlled IZAKHONO SUPER AI workflow route is configured, Builder uses it to enrich the inferred product type, name, modules and build priorities; if that route is unavailable, the deterministic local planner continues without failing the build. No external AI provider is required for the core create → plan → generate → validate → internal-commit workflow.

## Multi-channel release pack

Every generated application now receives a release-channel baseline alongside its Worker source:

- installable PWA manifest and service worker;
- `release/channels.json` as the channel truth record;
- Android, iOS and desktop release-gate manifests.

The web/PWA artifact is generated and installable, but public deployment still requires the normal owned-runtime HTTPS and acceptance gate. Android and iOS manifests explicitly record that signed packages and store-release evidence are still required; the Builder never treats a prepared wrapper as a public store release.

## One-click release candidate

An authenticated Owner can now send any planned Builder project through one controlled action:

`plan (when needed) → generate → deterministic validation → IZAKHONO internal repository commit → release candidate`.

The endpoint is `POST /api/projects/:id/autopilot`. The Owner interface also injects **Build to release candidate** on project cards and **Import & Build** beside the handoff importer.

A successful run sets project status to `deploy_ready` and stores an `izakhono.release-candidate/v1` receipt containing the generated revision, IZAKHONO internal repository head, and channel-specific next gates. It deliberately keeps `public_live: false`.

Web/PWA still requires owned-runtime deployment plus HTTPS and end-to-end acceptance proof. Android and iOS still require signed packages and their respective store submission/release evidence. The one-click action therefore prepares a release candidate; it does not bypass deployment, signing, store, legal or product acceptance gates.

## Repository Autopilot v1

Generated Worker applications leave the factory as repository-ready packages rather than loose source files. Each bundle includes least-privilege CI, a credential-gated isolated-preview workflow, private-by-default repository metadata, local-secret exclusions and a versioned Builder technical preview.

When the Builder runtime has the optional server-side GitHub automation credential, it can mirror a validated generated bundle into a new private GitHub repository. It refuses to overwrite an existing repository, and provider preview credentials are never generated into source.

See `docs/REPOSITORY-AUTOPILOT-V1.md`.

## Fast Build v0.2

The reusable Alpha gate lives at `.github/workflows/izakhono-build-to-alpha.yml`.

A target repository supplies a small `.izakhono.json` contract and the caller workflow from `templates/call-izakhono-alpha.yml`. IZAKHONO then validates safe repository paths, builds the declared Docker application, labels the image with product and Git provenance, starts it, and requires its HTTP health gate to pass.

The caller template pins the central policy to an **immutable reviewed commit SHA** rather than a moving branch such as `main`. Policy upgrades therefore require an explicit reviewed pin change instead of silently changing existing project trust boundaries.

Projects may also opt into reviewed project-specific Alpha rehearsal and Windows packaging using fixed script paths. The Owner interface does **not** accept arbitrary shell commands.

Current policy adoption uses manifest v3, which also enforces the portfolio-wide owned-first, externally reversible infrastructure directive and approved evidence-based deployment status labels. Older immutable policy pins remain unchanged until explicitly migrated.

See `docs/FAST-BUILD-V0.2.md`, `docs/INFRASTRUCTURE-DIRECTIVE-INHERITANCE.md` and `templates/izakhono.manifest.example.json`.

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
