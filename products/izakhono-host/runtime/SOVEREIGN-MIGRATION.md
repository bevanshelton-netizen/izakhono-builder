# IZAKHONO Sovereign Migration — Hardware → Software

## Replace where software is sufficient

| Traditional component | IZAKHONO software equivalent |
|---|---|
| Load balancer appliance | Software edge/router + health-aware traffic scheduler |
| Reverse proxy appliance | IZAKHONO Edge |
| Deployment platform | IZAKHONO Runtime |
| Container orchestration appliance | Scheduler + node agents |
| Server provisioning appliance | Immutable container/image provisioning |
| Monitoring appliance | Runtime telemetry + health gates + audit events |
| Failover appliance | Revision promotion + automatic rollback + node failover |
| Firewall appliance (application layer) | Software policy engine + fail-closed edge |
| CDN control plane | Software cache/edge orchestration layer |
| DNS management appliance | IZAKHONO DNS control plane + provider adapters |
| Certificate appliance | Automated ACME/TLS lifecycle software |
| Backup appliance | Content-addressed artifact/object backup layer |
| Job scheduler appliance | Durable software job queue + worker agents |

## Hardware that remains

Software does not magically eliminate physics. We still need compute, storage, power, network connectivity and physical security somewhere. The objective is to minimize specialized hardware and make commodity infrastructure fungible.

## Sovereign architecture

`IZAKHONO HOST`
`    ↓`
`CONTROL PLANE → POLICY → SCHEDULER`
`    ↓`
`NODE01 / NODE02 / NODE03 / ...`
`    ↓`
`CONTAINERS + SERVICES`
`    ↓`
`IZAKHONO EDGE → TLS → CUSTOMER DOMAIN`

The control plane owns the desired state. Nodes are replaceable workers. A node failure must not require application redesign.

## Non-negotiable acceptance gates

1. Immutable artifact exists.
2. Revision starts on a healthy node.
3. Health endpoint passes.
4. Edge route resolves to the revision.
5. HTTPS certificate is valid.
6. Public request returns expected application response.
7. Only then is the deployment marked `production`.

## Vercel exit policy

Vercel is not the primary platform. Existing Vercel deployment remains a temporary continuity/fallback adapter until each production workload has passed the above acceptance gates on IZAKHONO Runtime.
