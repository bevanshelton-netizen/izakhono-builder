# IZAKHONO CONNECT AI — Automation Studio

## Product direction
Extend I-CONNECT's contact-centre and corporate customer platform with a Manychat-class customer engagement and marketing automation layer. The product is not a clone: workflows should connect conversations to CRM, service operations, quotations, bookings, payments and measurable outcomes.

## Current delivery in this branch
- Adds an Automation Studio entry to the I-CONNECT Corporate Command navigation.
- Adds a responsive, interactive workflow canvas.
- Adds prompt-to-workflow draft generation for lead qualification, product enquiries, appointments and support triage.
- Adds editable trigger/action steps, browser-local draft fallback, cloud save/load and a queued server-side simulation test.
- Adds an idempotent test-run queue and atomic worker claim/finish RPCs. The worker only simulates nodes and records outcomes; it never sends messages or performs external actions.
- Clearly marks the UI as prototype/demo mode. No channels are connected and no external messages or business actions are executed.

## Architecture target
1. **Channel adapters:** WhatsApp Business Platform, Instagram Messaging, Facebook Messenger, Telegram, website chat, email and SMS. TikTok only where approved business messaging APIs are available.
2. **Event intake:** signed webhooks, idempotency keys, consent checks, provider event normalisation and replay protection.
3. **Workflow engine:** versioned graph definitions, typed nodes, branching, delays, retries, rate limits, dead-letter handling and execution audit.
4. **Conversation layer:** unified inbox, customer identity resolution, assignment, human handoff and conversation history.
5. **CRM and commerce:** tenant-scoped contacts, lead stages, tasks, catalogue references, quotes, bookings, payment links and order status.
6. **AI orchestration:** model-neutral gateway, tenant knowledge retrieval, structured tool permissions, output validation and human approval gates.
7. **Measurement:** delivery, response, qualified lead, booking, order and revenue attribution events.

## Data model proposal
Use the existing I-CONNECT organisation and membership model. Add tenant-scoped tables for:
- automation workflows and immutable workflow versions;
- channel connections and channel identities;
- contact profiles and channel identities;
- conversations, messages and message delivery events;
- workflow execution runs and step execution attempts;
- consent records, suppression lists and communication preferences;
- AI agent profiles, knowledge sources and tool grants.

All exposed tables require RLS. Every tenant-scoped query must enforce membership in the owning organisation. Provider secrets must never be returned to browser clients; store them in a protected server-side secret store. Do not rely on user-editable JWT metadata for authorization.

## Portable deployment
- I-CONNECT already includes a Node container image definition and Docker Compose service; the application is not tied to Vercel.
- Build from the repository root with `docker compose -f products/i-connect/docker-compose.yml build`.
- Configure `products/i-connect/.env.production` from `.env.example` using deployment-specific secrets; do not commit the production file.
- Start with `docker compose -f products/i-connect/docker-compose.yml up -d` and verify `/api/health` and `/api/runtime` on the host.
- The container is portable to an IZAKHONO-controlled host or another compatible container runtime. No host deployment is claimed until the endpoint is externally verified.

## Initial organisation-owner bootstrap
- The inspected Supabase project currently has one organisation but no authentication users or active organisation memberships. Cloud workflow save/load therefore cannot be exercised until the first authorised owner account is provisioned.
- A guarded operator-only script is provided at `scripts/bootstrap-owner.js`; it requires the Supabase service-role key, exact organisation slug, owner email/password and an explicit `I_CONNECT_CONFIRM_OWNER_BOOTSTRAP=YES` acknowledgement.
- The script refuses to run if the organisation already has an active member, does not expose a public bootstrap endpoint, and never prints the password or service-role key.
- Run it only from a trusted IZAKHONO-controlled environment using `npm run bootstrap:owner` in `products/i-connect`; do not commit the populated environment file.

## Workflow test execution
- Owner/admin/manager users can enqueue a manual test for a saved draft workflow. The queue is idempotent per organisation and key.
- The optional worker is enabled only with `I_CONNECT_WORKER_ENABLED=true` and the private `SUPABASE_SERVICE_ROLE_KEY` configured on the server.
- Worker RPCs atomically claim queued manual tests and record terminal outcomes. The worker accepts only the `manual_test` trigger type.
- Simulation is intentionally side-effect free: it records the nodes visited and explicitly reports zero external actions executed.
- Live triggers, messaging, CRM writes, payments, arbitrary code and external tool execution are not supported by this test worker.

## Cloud workflow persistence
- `GET /api/automation/workflows` requires a valid Supabase access token and returns workflows only for an active organisation membership.
- `POST /api/automation/workflows` requires owner/admin/manager membership and saves a workflow plus immutable version graph atomically through `public.ic_save_workflow`.
- The API uses the Supabase anon key with the caller's bearer token so database RLS remains in force. It does not use the service-role key.
- The browser adapter accepts the access token from `window.I_CONNECT_SESSION.access_token` or `sessionStorage.i_connect_access_token`; connect this to the platform's authenticated session manager before production use.
- Workflow graph payloads are limited to 256 KB. Channel credentials are not accepted or stored by this endpoint.

## Activation gates
A workflow must not be marked live until:
- tenant identity and role permissions are verified;
- provider connection credentials and webhook signatures are verified;
- channel-specific opt-in, messaging windows and approved templates are enforced;
- rate limits, idempotency, retries and dead-letter handling pass tests;
- human handoff and stop/suppression controls are tested;
- privacy, retention, POPIA and audit requirements are reviewed;
- an end-to-end test proves delivery through the selected provider.

## Non-goals for this prototype
This branch does not claim a live WhatsApp/Meta/TikTok integration, live workflow action execution, AI model execution, payment execution, or production readiness. Cloud draft persistence and side-effect-free workflow test-run queuing are implemented, subject to first-owner provisioning and runtime configuration.
