# FORTRESS INTELLIGENCE™ — PRODUCTION READINESS GATE

This checklist defines what must be true before FORTRESS is sold as a live screening/compliance service.

## Gate 1 — Data and licensing

- [ ] CIPC access agreement/subscription confirmed for intended use
- [ ] VerifyNow commercial/reseller terms signed if their service is exposed through FORTRESS
- [ ] OpenSanctions commercial licence/reseller terms signed for intended use
- [ ] FIC/local source usage rights and update process documented
- [ ] Every provider mapped to permitted jurisdictions, purposes, retention and redistribution rules

## Gate 2 — Security

- [ ] Secrets stored server-side only
- [ ] Tenant isolation tested
- [ ] RBAC and least-privilege roles tested
- [ ] Encryption in transit and at rest configured
- [ ] Audit events are append-only/immutable
- [ ] Rate limits and provider spend limits enabled
- [ ] Backup and restore procedure tested
- [ ] Incident-response procedure documented

## Gate 3 — Data protection

- [ ] Lawful purpose and processing basis documented
- [ ] Data minimisation rules implemented
- [ ] Retention/deletion schedules implemented
- [ ] Data-subject request workflow documented
- [ ] Cross-border transfer assessment completed where applicable
- [ ] Processor/operator agreements completed
- [ ] Customer responsibilities documented

## Gate 4 — Matching and decision quality

- [ ] Identity-resolution model tested with representative false-positive cases
- [ ] Match confidence and reason codes stored with every result
- [ ] Source provenance displayed to authorised reviewers
- [ ] No raw provider hit is treated as proof of wrongdoing
- [ ] Human review and disposition workflow tested
- [ ] Adjudication outcomes auditable
- [ ] Regression test set established before changing matching logic

## Gate 5 — Operations

- [ ] Provider health monitoring
- [ ] Usage and quota metering
- [ ] Failed-provider fallback behaviour
- [ ] Monitoring/re-screening worker
- [ ] Case SLA and escalation process
- [ ] Customer support process
- [ ] Status/incident communications process

## Gate 6 — Commercial launch

- [ ] Terms of service approved
- [ ] Privacy notice approved
- [ ] DPA template approved where required
- [ ] Pilot SOW approved
- [ ] Pricing approved
- [ ] Refund/cancellation rules approved
- [ ] Sales demo clearly labelled when synthetic
- [ ] Security overview and architecture pack ready for enterprise buyers

## Launch rule

Until all mandatory gates are satisfied, FORTRESS may be demonstrated as a synthetic prototype or used in a controlled pilot environment, but must not be represented as a production-ready live screening service.
