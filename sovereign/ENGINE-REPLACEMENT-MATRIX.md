# IZAKHONO Sovereign Engine Replacement Matrix

## Directive
External platforms are adapters, not foundations. Every material external dependency must have an IZAKHONO-owned replacement path.

## Replacement engines

| Current blocker/dependency | IZAKHONO replacement engine | Primary ownership | External role |
|---|---|---|---|
| GitHub source dependency | IZAKHONO SOURCE ENGINE | IZAKHONO | Mirror/backup only |
| GitHub Actions | IZAKHONO BUILD & CI ENGINE | IZAKHONO | Optional runner |
| Vercel hosting/deployment | IZAKHONO DEPLOY ENGINE | IZAKHONO | Optional adapter |
| Netlify limits | IZAKHONO STATIC/EDGE HOST ENGINE | IZAKHONO | Optional fallback |
| Cloudflare DNS/edge dependency | IZAKHONO DNS & EDGE ENGINE | IZAKHONO | External DNS/edge fallback |
| Supabase dependency | IZAKHONO DATA ENGINE | IZAKHONO | Database adapter |
| Hostinger/Xneelo hosting | IZAKHONO HOSTING FABRIC | IZAKHONO | External hosting fallback |
| Third-party object storage | IZAKHONO OBJECT STORE | IZAKHONO | Replication target |
| Third-party queues | IZAKHONO QUEUE ENGINE | IZAKHONO | Fallback transport |
| Third-party identity | IZAKHONO IDENTITY ENGINE | IZAKHONO | Federation adapter |
| Third-party email hosting | IZAKHONO MAIL ENGINE | IZAKHONO | Relay/fallback |
| External SSL automation | IZAKHONO CERT ENGINE | IZAKHONO | ACME/provider adapter |
| External AI coding dependency | IZAKHONO AI GATEWAY | IZAKHONO | Model/provider adapters |
| External monitoring | IZAKHONO OBSERVABILITY ENGINE | IZAKHONO | Optional exporters |
| Physical NODE01 single point of failure | IZAKHONO NODE FABRIC | IZAKHONO | Any approved compute provider |

## Operating rule
1. Prefer local/owned engine.
2. If unavailable, route to another IZAKHONO node.
3. If capacity is unavailable, route through an approved external adapter.
4. Record the dependency and allow migration back to owned infrastructure.
5. Never make an external provider a required control-plane dependency.

## Success condition
IZAKHONO must remain capable of source management, build, test, execution, deployment, storage, identity, DNS, certificates, mail, AI orchestration, observability and recovery when GitHub, Vercel, Cloudflare, Supabase and similar providers are unavailable.
