# IZAKHONO BUILDER

Visual, free-first application factory for IZAKHONO projects.

## What it does

- register new apps
- choose reusable product modules
- generate build recipes
- track build/deploy status
- store project history in D1
- protect owner operations with a server-side secret
- deploy on Cloudflare's free-first stack
- reuse one central **IZAKHONO Build to Alpha** gate across Docker-capable projects

## Fast Build v0.2

The reusable Alpha gate lives at `.github/workflows/izakhono-build-to-alpha.yml`.

A target repository supplies a small `.izakhono.json` contract and the caller workflow from `templates/call-izakhono-alpha.yml`. IZAKHONO then validates safe repository paths, builds the declared Docker application, labels the image with Git/product provenance, starts it, and requires its HTTP health gate to pass.

The caller template pins the central policy to an **immutable reviewed commit SHA** rather than a moving branch such as `main`. Policy upgrades therefore require an explicit reviewed pin change instead of silently changing existing project trust boundaries.

Projects may also opt into reviewed project-specific Alpha rehearsal and Windows packaging using fixed script paths. The Owner interface does **not** accept arbitrary shell commands.

See `docs/FAST-BUILD-V0.2.md` and `templates/izakhono.manifest.example.json`.

## Safety and readiness

- no production secrets committed to source control
- no arbitrary Owner-mode shell execution
- immutable policy pins for generated/copyable Alpha caller workflows
- failed health gates are not promoted
- artifact retention is convenience, not proof of software correctness
- CI validation is not a substitute for real public hosting, DNS/TLS, disaster recovery, physical-device testing, code signing, external security review, privacy/legal approval or customer acceptance

## Cost principle

Use free-first infrastructure where practical, but do not pretend compute and platform quotas are unlimited. Upgrade only when demand, revenue, compliance or a hard technical requirement justifies it.
