# IZAKHONO PARALLEL — ROOT / I-NET Integration Gate

**Status:** engineering audit and implementation boundary  
**Audit date:** 2026-11-21  
**Target:** integrate the existing PARALLEL shell, IZAKHONO ONE HUB, the `one` schema service registry, and the I-NET Power20 gateway without creating another Supabase Edge Function.

## 1. Verified existing assets

- `products/izakhono-parallel/README.md` and `parallel.manifest.json` define the product shell and seven foundational pillars.
- `products/izakhono-inet-power20/src/` contains a 20-service catalog, consent/privacy decision logic, a gateway authorizer, and tests.
- Supabase project `yfawrenhudjomhnglfhq` has an active `izakhono-one-hub` Edge Function (version 23 in the function listing).
- The `one` schema contains `service_registry`, `service_contracts`, `service_runtime_state`, `service_events`, and `audit_events`.
- Read-only inspection found seven rows in each of `service_registry`, `service_contracts`, and `service_runtime_state`; the seven registry entries are AI, Cloud, Commerce, CONNECTA, FORTRESS, NAV, and SEARCH.
- Read-only inspection found zero rows in `service_events` and `audit_events` at audit time.
- All 13 inspected tables in schema `one` have RLS enabled, but `pg_policies` returns **zero policies** for the schema and `FORCE ROW LEVEL SECURITY` is false on every inspected table. `anon` and `authenticated` have no schema USAGE or table privileges; `service_role` has schema USAGE and broad table privileges, including UPDATE/DELETE on `audit_events`, `service_events`, and `service_registry`. Keep that role server-only and treat its privilege set as a least-privilege remediation item.
- No triggers were found in schema `one`. Existing primary/foreign keys and selected CHECK constraints are present, but there is no database trigger evidence for append-only audit enforcement or automatic runtime/event maintenance.
- The seven registry rows each have a matching contract and runtime row. All seven contracts are enabled, but every runtime row remains `state=foundation`, `health=unknown`, and has no `last_check_at` or `last_event_at`; these are not evidence of live/healthy services.
- A source review found that the I-NET gateway previously accepted a consent grant based only on permission/domain scope, without binding the grant to the requesting subject and service. Its route guard used a raw string prefix, allowing sibling-prefix and dot-segment paths to pass. The feature branch now adds exact subject/service grant binding and decoded route-boundary checks with regression tests.

## 2. Integration gaps

1. The current ONE HUB function defines its seven pillars in a hard-coded array. Its manifest, search, resolve, and route responses are therefore not yet driven by the database registry.
2. The ONE HUB `/api/foundation` response advertises the registry, event, and audit stores as ready, but the endpoint source does not query those tables. Treat that response as a declared architecture status, not proof of a live database-backed control plane.
3. The current ONE HUB handler accepts GET and HEAD only. It does not implement the planned identity/session hand-off or service-event write path.
4. The deployed function listing reports `verify_jwt=false`. Do not add user-specific data, write operations, or privileged dispatch to this public handler until authentication, authorization, and rate-limiting boundaries are proven.
5. The I-NET Power20 gateway is a library-level authorizer with consent-scope checks; its current request model and tests do not establish a complete authenticated runtime or cross-service session exchange.
6. The existing PARALLEL manifest identifies some services as existing and others as foundation. Runtime availability must be checked independently before displaying a service as live.

## 3. Non-negotiable implementation rules

- Keep the existing ONE HUB as the control-plane entry point; do not create another Edge Function for the shell.
- Treat `one.service_registry` and `one.service_contracts` as the canonical service catalogue only after validating constraints, RLS, write ownership, and seed/migration history.
- Keep the Power20 catalog as a versioned capability/policy contract; reconcile it with the seven live registry entries rather than silently treating all 20 entries as deployed.
- Never trust a browser-supplied subject ID, permission, role, tenant, or consent claim. Derive the principal from a verified server-side auth context.
- Enforce exact route boundaries, service status, declared permissions, data domains, consent expiry/revocation, and tenant/entity isolation server-side.
- Use short-lived, audience-bound, single-use hand-off tokens if cross-service hand-off is introduced. Never pass provider access tokens or service-role credentials to the browser.
- Emit correlated audit events for allow/deny decisions and administrative registry changes, while excluding secrets and unnecessary personal data.
- Preserve export, revocation, deletion, and data-minimisation guarantees.
- External hosting, database, identity, DNS, and CI providers remain replaceable adapters until IZAKHONO-owned runtime is independently proven.

## 4. Delivery sequence

### Gate A — contract and data integrity
- Inspect constraints, indexes, triggers, grants, RLS policies, and migration history for the five `one` tables. **Observed:** no RLS policies exist; `anon`/`authenticated` lack schema/table access; `service_role` is privileged and server-only; audit/event tables are not append-only at the grant level; no triggers exist. Define explicit policies and least-privilege service-role access only after the intended access model and server-side caller are confirmed.
- Confirm the registry and contract rows agree and define the allowed status vocabulary.
- Map the seven registered services to the existing shell and identify the 13 additional Power20 catalog entries as planned/unregistered unless proven otherwise.
- Add deterministic contract tests for missing services, disabled services, unknown statuses, malformed routes, and version mismatch.
- Completed in this branch: I-NET gateway checks now bind consent to the exact subject and service and reject sibling-prefix, encoded traversal, malformed encoding, and backslash route paths. Regression tests were added; execution evidence is still pending.

### Gate B — database-backed read-only registry
- Refactor the ONE HUB manifest/search/resolve/route endpoints to read from a bounded, server-side registry query.
- Keep the endpoint read-only and do not expose internal metadata or credentials.
- Return service status and health as distinct fields; never infer production readiness from a seed row.
- Test empty registry, unavailable database, stale runtime state, and unknown slug behavior.

### Gate C — authenticated identity and policy
- Define the canonical IZAKHONO ONE principal and tenant/entity context.
- Validate JWTs server-side and map identity to explicit service permissions.
- Integrate I-NET consent checks and deny by default.
- Add short-lived service hand-off only after replay protection, audience binding, expiry, revocation, and entity isolation tests pass.

### Gate D — events, audit, and runtime health
- Add server-mediated, schema-validated service events with idempotency and correlation IDs.
- Record authorization outcomes and privileged changes in append-only audit paths.
- Add health freshness and degraded-state rules; a successful function ping alone is not end-to-end health.

### Gate E — release evidence
- Run unit, integration, negative-security, and end-to-end tests.
- Verify no secrets are committed and no privileged credential reaches a client.
- Confirm backup/restore and provider-exit procedures.
- Deploy only to a controlled non-production target first; production activation requires explicit release approval and verified runtime access.

## 5. Acceptance criteria

- The PARALLEL shell lists exactly the services returned by the canonical registry and clearly distinguishes foundation, available, degraded, and unavailable states.
- Search, resolve, and route are consistent and deterministic from one registry snapshot.
- Unauthenticated and unauthorized requests cannot enumerate private service metadata or invoke protected services.
- Cross-service access is denied by default and only granted for the verified principal, tenant, permission, data domain, route, and active consent.
- Replays, expired/revoked consent, wrong audience, wrong tenant, unknown service, disabled service, and malformed route all fail closed.
- Every privileged decision has a correlated audit record without leaking secrets.
- Existing independent service deployments continue to work if the PARALLEL shell or one external adapter is unavailable.
- No production status is claimed without end-to-end evidence.

## 6. Current release position

This document records an audit and a safe implementation sequence. The I-NET library gateway and its regression tests have been hardened in the feature branch, but test execution is not yet evidenced. It does not claim that the integration, independent hosting, public DNS delegation, or production launch is complete. No live Edge Function or production database object was modified during this audit.
