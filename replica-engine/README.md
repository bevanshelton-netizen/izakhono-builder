# IZAKHONO REPLICA ENGINE v1

A clean-room product-building workflow for IZAKHONO BUILDER, inspired by the public eleven-stage replica-skill pattern.

## The pipeline

`RECON -> ARCHITECT -> DESIGN -> BUILD -> BACKEND -> TEST -> PARITY -> BUSINESS INTELLIGENCE -> BRAND -> LAUNCH -> DEPLOY`

The engine is deliberately **not** a code copier. It converts an approved brief or permitted product study into requirements and a Builder handoff. Protected source code, logos, trademarks, proprietary assets, private APIs and protected content are excluded.

## Runtime boundary

- `scripts/izakhono-replica-engine.py` creates a deterministic `replica/` planning package.
- `replica-engine/workflow.json` is the stage contract.
- `IZAKHONO BUILDER /api/build-anything` remains the actual source-generation engine.
- IZAKHONO internal repositories remain the source of truth.
- Release candidates remain non-public until deployment evidence and acceptance gates pass.

## Quick start

```bash
python3 scripts/izakhono-replica-engine.py \
  --brief "Build a customer booking platform with payments, reminders and an admin dashboard" \
  --target app
```

The output contains `intent.json`, `workflow.json`, `features.csv`, `architecture.md`, design tokens, a test plan and a manifest.

## Why this is better for IZAKHONO

The public reference workflow is useful, but IZAKHONO adds the missing operating layer: owned-first infrastructure, internal source authority, release-candidate evidence, provider reversibility and a controlled Builder handoff.

The result is a **business-to-software factory**, not just an app-cloning prompt pack.
