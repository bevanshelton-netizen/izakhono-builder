# IZAKHONO ONE-DAY APP FACTORY — EXECUTION V1

## Real execution path

The factory now exposes an owner-authenticated execution route:

`POST /api/factory/run`

Request:

```json
{
  "brief": "Build a paid app that ..."
}
```

The route is a controlled bridge into the existing Builder runtime:

1. **Intake** — validate the brief.
2. **Build Anything** — classify the brief, select reusable modules and create the Builder project.
3. **Autopilot** — run the existing plan → generate → deterministic validation → internal repository commit → release-candidate path.
4. **AI routing** — existing SUPER AI/free-first routing remains provider-neutral and replaceable.
5. **Security/QA** — existing Builder gates remain authoritative.
6. **Package** — release-candidate evidence is returned.
7. **Deploy** — deliberately remains `release-candidate-only` in this route.
8. **Revenue** — never auto-published by this endpoint.

## Security boundary

The bridge does not implement a second authentication system. It forwards the original request headers to the existing secured Builder endpoints, so the established owner/admin authorization remains the source of truth.

The bridge does not:

- store API keys;
- embed provider secrets;
- execute arbitrary shell commands;
- bypass project ownership checks;
- publish directly to the public internet;
- mark a project `public_live` without the existing evidence gates.

## Why this is the important milestone

Before this bridge, the One-Day App Factory could produce a plan. With this bridge, a single authenticated factory request can enter the actual Builder lifecycle and return a real release-candidate result.

The architecture remains **owned-first, evidence-gated and externally reversible**.

Production promotion is intentionally controlled by the repository's `[deploy-builder]` workflow gate; this commit requests that gate rather than bypassing it.
