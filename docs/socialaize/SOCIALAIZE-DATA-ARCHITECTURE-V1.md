# SOCIALaiZe — Logical Data Architecture V1

**Status:** Conceptual data model only; not SQL and not a migration proposal.

## 1. Data ownership rules

Every customer-owned record must be scoped to a workspace and the relevant verified legal entity and platform. Tenant context must be derived from trusted identity/session claims or an authenticated internal service, never trusted from a caller-supplied workspace/entity identifier alone.

Cross-tenant access is denied by default. Cross-entity aggregation or transfer requires a separately authorised, audited workflow.

## 2. Logical domains

- **Identity references:** external subject reference, membership, role and session references; do not duplicate the identity authority.
- **Workspaces:** workspace, owner, edition, status, locale, region and lifecycle.
- **Memberships:** user reference, workspace, role, invitation and access state.
- **Brands:** name, slug, market, locale, brand kit reference, voice guide and approval policy.
- **Social connections:** provider, external account reference, granted scopes, token secret reference, expiry, health and revocation state.
- **Content:** brief, content item, channel variant, asset reference, rights/provenance, disclosure and review state.
- **Calendar:** planned publication time, timezone, channel, approver and schedule state.
- **Campaigns:** objective, offer, audience, budget boundary, destination, attribution plan and approvals.
- **Publishing jobs:** idempotency key, provider, external job/post reference, state, attempts, lease, next retry and final evidence.
- **Analytics:** metric definition, value, currency, source, attribution model, time window, freshness and completeness.
- **Leads:** consent evidence, source/campaign attribution and CRM handoff reference; canonical contact/deal remains in CRM.
- **AI tasks:** provider/model, task type, input/output references, safety result, approval, cost and completion evidence.
- **Billing references:** customer/subscription/entitlement references only; canonical invoices and payment ledger remain in IZAKHONO commercial systems.
- **Audit references:** actor, workspace/entity/platform, action, resource, timestamp, correlation ID and immutable event reference.

## 3. Key relationships

Workspace 1:N memberships, brands, campaigns, social connections, content and analytics views. Brand 1:N content, campaigns and connected accounts. Campaign 1:N content variants, publishing jobs, measurement windows and CRM attribution references. Publishing job 1:N attempts and provider events.

## 4. Data classification

- Public: published brand posts and explicitly public profile details.
- Customer confidential: drafts, strategy, campaign budgets, analytics and lead records.
- Restricted: OAuth credentials, refresh tokens, API keys, billing identifiers and security evidence.
- Sensitive personal information: direct messages, contact information and consent records; collect the minimum necessary and apply stricter access and retention.

## 5. Isolation and security

- Apply database row policies or equivalent server-side predicates to every tenant-owned resource.
- Validate both workspace membership and resource-level permission.
- Use composite ownership constraints where appropriate.
- Keep secret material in an approved secrets manager; persist only opaque secret references.
- Use private object storage and short-lived authorised download URLs.
- Audit privileged access and cross-entity workflows.
- Avoid exposing unrestricted views that bypass row-level controls.
- Do not place service-role or owner credentials in browser bundles.
- Separate analytics aggregation from raw personal data and enforce minimum cohort thresholds where re-identification is possible.

## 6. Lifecycle and portability

Define export, correction, retention, legal hold, deletion, backup and restore semantics before collecting production customer data. Disconnecting a provider must revoke tokens and stop new jobs while retaining only legally required audit evidence.

## 7. Migration boundary

This document contains no DDL, migration filename, database target, owner, runner or approval. Any future schema proposal must identify the authoritative database, confirmed owner, approved migration runner, reviewed checksum, backup/rollback plan and disposable-environment test before production execution.
