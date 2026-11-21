# I-CONNECT API Control Plane

The I-CONNECT API is the control plane for identity, tenants, contact-centre operations, service provisioning, billing, usage and carrier-neutral voice orchestration.

## Identity and tenancy
- One authenticated user can belong to multiple organisations.
- Each organisation owns service entitlements.
- Roles are scoped to the organisation.
- Every privileged mutation must be auditable.
- Production authentication is delegated to Supabase Auth; no passwords are stored by these functions.

## Roles
`owner`, `admin`, `manager`, `agent`, `dispatcher`, `finance`, `viewer`

## Service entitlements
`voice`, `contact_centre`, `mobile`, `connectivity`, `wifi`, `fleet`, `secure_fleet`, `provisioner`

## Customer control
The authenticated customer-control layer exposes the existing Supabase control-centre read model and routes service lifecycle mutations through the canonical connectivity state machine. Customer actions require a caller-supplied idempotency key and are recorded in mutation metadata.

Lifecycle actions:
- `provision` → `PROVISIONING`
- `activate` → `ACTIVE`
- `suspend` → `SUSPENDED`
- `resume` → `ACTIVE`
- `terminate` → `TERMINATED`
- `retry` → `PROVISIONING`

The database remains authoritative for permitted transitions and tenant authorization. Invalid transitions are rejected by the state machine.

## Contact-centre model
- Queues
- Agents
- Registered mobile bridge mode
- Softphone mode
- Masked customer numbers
- Call state and CDR foundation
- Dispositions and billable seconds

## Provisioning model
Provisioning jobs are idempotent and move through:
`pending -> approved -> running -> waiting_provider -> completed|failed|cancelled`.

Provider credentials remain server-side and are never stored in source control.

## Handover model
Provisioning handover operations are job-based and call the canonical RPCs with `p_job_id`:
- build
- release
- revoke

## Billing model
- ZAR-ready invoices stored in integer cents.
- Usage records support service, quantity, unit pricing and rated amount.
- Voice CDRs can feed usage rating once an authorised carrier adapter is connected.
- Checkout and payment flows remain behind the existing payment-provider boundary.

## Security
The second migration moves privileged membership checks out of the exposed `public` schema into `ic_private`, revokes PUBLIC execution, scopes execution to authenticated users and keeps RLS on every exposed application table.

## Production boundary
The API contracts and schema are deployable, but real customer identity and persistent telecom state require the dedicated I-CONNECT Supabase project to be connected through environment variables.

Real PSTN calls and live mobile service require an authorised carrier/SIP adapter, compliant numbering and credentials. The application must not represent those services as live until independently verified.

## Customer checkout API

The owned Express runtime mounts the shared customer endpoints through
`runtime/register-api-routes.js`:

- `POST /api/checkout-intent` creates a checkout intent through
  `ic_prepare_checkout_intent_for_customer`. A valid Supabase user bearer token
  is required; the database records the authenticated user as the owner.
- `POST /api/checkout-state` reads the checkout state through
  `ic_checkout_state_for_customer`. The database verifies ownership and omits
  the external payment reference from the customer response.
- `POST /api/provider-attempt` is deliberately disabled (HTTP 410). It must
  not be exposed as a public service-role RPC. Provider orchestration belongs
  behind a server-to-server integration with verified checkout-session
  ownership and a restricted provider allowlist.

The Supabase publishable/legacy anon key is only the API key; it does not
authenticate a customer. Customer RPCs still require a valid Supabase Auth
access token. A configured API key or checkout intent does not mean payment
is ready. A live provider connection, merchant credentials, signed webhook
verification and a real payment acceptance test are separate requirements.

## Browser authentication

`GET /api/public-config` returns only the I-CONNECT Supabase URL and publishable/legacy anon API key. These values are public client configuration; no service-role key or provider secret is returned. The browser signs in or signs up directly with Supabase Auth, keeps its session in tab-scoped storage, and refreshes access tokens before customer API calls.

## Current checkout boundary

A checkout intent is only a pre-payment request. It is not a payment session and does not charge a customer. The current I-CONNECT catalog has no active I-CONNECT-priced product, and `pay_provider_connections` has no configured provider connection. The UI must display the returned `payment_ready=false` reason and must not imply that payment or telecom provisioning has begun.

## Organisation onboarding

- `POST /api/my-organizations` returns only active organisations where the authenticated user has an active membership. The database function uses `auth.uid()`; anonymous execution is revoked.
- `POST /api/onboarding` creates the authenticated user's owner organisation through `ic_create_owner_organization`. The database enforces one owner organisation per user and records an audit event.
- The My I-CONNECT screen automatically selects a single organisation, prompts when the user has multiple memberships, and offers owner onboarding when none exists.
