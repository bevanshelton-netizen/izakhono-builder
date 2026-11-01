# IZAKHONO Node Identity Contract

## NODE01 is software

`NODE01` is a software/runtime node identity. It is **not** the name of a physical machine, server, laptop, VM, or other hardware asset.

The same rule applies to `NODE02`, `NODE03`, and `NODE04`.

### Required interpretation

- **Node identity:** `NODE01` (software/runtime identity)
- **Physical host:** infrastructure underneath the node; its hostname, IP, hardware and VM identity are separate concerns
- **Runtime:** the software stack that exposes the node's health and service capabilities
- **Endpoint:** the network address currently used to reach that runtime instance

A node identity MAY move between approved physical hosts without changing its logical identity. A physical host MAY host a node identity without becoming that node identity.

### Deployment rule

All automation MUST address NODE01 as a runtime identity. No deployment, health gate, provisioning flow, DNS rule, or release contract may require a specific physical machine to be named NODE01.

External platforms such as Vercel are fallback adapters only. They are not the definition of NODE01 and are not the owned runtime foundation.

### Evidence rule

Runtime evidence proves that the software node identity is healthy at the supplied endpoint. It does not prove a physical-host identity, and physical-host topology must never be substituted for runtime evidence.

### Canonical identity fields

```json
{
  "nodeId": "NODE01",
  "identityType": "software-runtime",
  "physicalHostIsSeparate": true
}
```

This contract is authoritative for IZAKHONO node-cluster terminology.
