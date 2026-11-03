# NODE01 — IZAKHONO Owned Runtime

NODE01 is the authoritative IZAKHONO-owned runtime target for NAV.

## NAV deployment

From the repository root on NODE01:

```bash
./infra/node01/deploy-nav-node01.sh
```

The deployment uses the existing owned Docker/Caddy stack under `infra/contabo/` and performs local health, readiness and smoke verification before reporting completion.

## Runtime principle

- NODE01 is the production runtime target.
- GitHub is the source-control and release source.
- Docker provides application isolation.
- Caddy provides the TLS edge.
- `nav.izakhono.africa` is the intended public NAV domain.
- Vercel and Netlify are not deployment dependencies.

The script does not claim public availability until local verification succeeds.
