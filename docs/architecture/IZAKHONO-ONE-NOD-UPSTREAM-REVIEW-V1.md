# Nod Upstream Review — IZAKHONO ONE v1.0

**Review date:** 2026-11-26  
**Upstream:** [n8n-io/nod](https://github.com/n8n-io/nod)  
**Upstream license declared in repository:** Apache-2.0  
**Decision:** Candidate for controlled evaluation; not yet adopted, vendored, installed, or deployed.

## Why Nod is relevant

Nod is the open-source personal-agent project identified for this initiative. Upstream describes a standalone agent with its own computer and browser, local execution, user-selected model provider, and approval checks before consequential actions. Its repository lists Apache-2.0 and describes a TypeScript/Node application using a browser automation component and a containerized workspace.

This matches the desired personal-agent/browser capability more closely than the AI Commander remote execution product. Nod is an upstream candidate, not a replacement for IZAKHONO's own identity, policy, audit, node control, or user authority.

## Licence and provenance

The upstream repository currently declares Apache License 2.0. Before any source reuse:
- pin a reviewed upstream commit or release;
- retain copyright, licence and NOTICE material as required;
- identify and preserve third-party component licences;
- generate a dependency/SBOM and vulnerability review;
- record modified files and upstream origin;
- confirm that the selected release and bundled components permit the intended distribution.

A repository-level Apache-2.0 declaration does not automatically relicense every bundled asset or dependency.

## Cost and operational fit

The source is available without a purchase. Running a model may still incur API charges unless an approved local model is used. Upstream documents a default hosted connection service for some app integrations and usage-data sharing settings; these must be reviewed and disabled or replaced where feasible before IZAKHONO use. Do not connect real accounts during evaluation.

The upstream package declares Node.js >=24.21.0. The current IZAKHONO ONE package declares Node >=20, so Nod should initially be evaluated as an isolated runtime boundary, not imported into the existing process. Its documented runtime includes Docker/container infrastructure and a sizeable dependency set; a no-cost code license does not mean zero compute, storage, network, or model cost.

## Proposed evaluation path

1. Continue the IZAKHONO-owned browser policy and test harness as an independent, small module.
2. Review a pinned Nod release and security model in an isolated, disposable software-defined execution environment.
3. Inventory its browser, workspace, approval, secret-handling, telemetry, connection-relay and licensing boundaries.
4. Run only local fixtures and synthetic identities; no user credentials or real app accounts.
5. Compare a clean adapter/compatibility boundary against selective upstream adoption.
6. Require FORTRESS review, explicit cost approval and user authorization before any real account actions or deployment.

## Non-authorisations

This review does not authorise paid services, model API spend, package installation, container/host provisioning, upstream source copying, credentials, real-world browser actions, production deployment, or changes to DNS/mail/production infrastructure.
