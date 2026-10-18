# FORTRESS Customer API Contract

## Authentication

Production requests must carry a tenant-scoped authenticated identity. API keys, OAuth/OIDC or SSO may be used depending on edition. Tenant ID must never be accepted from an untrusted request body as the sole authorization control.

## Core endpoints

### `GET /health`
Returns service health and current operating mode.

### `POST /screen`
Accepts a person or organisation search entity and returns provider results, evidence references and an explainable screening decision.

### `POST /cases`
Creates a human-review case from a screening result.

### `GET /cases/:id`
Returns a case only when the authenticated tenant is authorised to access it.

### `POST /cases/:id/decision`
Records an analyst disposition and audit event.

### `GET /evidence/:id`
Returns provenance evidence subject to tenant authorization.

## Response principle

Every screening response should make it clear whether the result is synthetic, controlled-pilot or live-provider data. Risk signals are not findings of guilt and should be accompanied by provenance and review status.
