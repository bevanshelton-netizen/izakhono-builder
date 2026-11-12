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
- tenant-scoped contact profiles, channel identities and append-only communication lawful-basis/consent records;
- organisation-scoped inbox threads and minimal message records, with explicit retention expiry;
- workflow execution runs and step execution attempts;
- consent records, suppression lists and communication preferences;
- AI agent profiles, knowledge sources and tool grants.

All exposed tables require RLS. Every tenant-scoped query must enforce membership in the owning organisation. Provider secrets must never be returned to browser clients; store them in a protected server-side secret store. Do not rely on user-editable JWT metadata for authorization.

## Portable deployment
- I-CONNECT already includes a Node container image definition and Docker Compose service; the application is not tied to Vercel.
- Build from the repository root with `docker compose -f products/i-connect/docker-compose.yml build`.
- Configure `products/i-connect/.env.production` from `.env.example` using deployment-specific secrets; do not commit the production file.
- Start with `docker compose -f products/i-connect/docker-compose.yml up -d` and verify `/api/health` and `/api/runtime` on the host.
- The container is portable to an IZAKHONO-controlled host or another compatible container runtime. Put it behind an IZAKHONO-controlled TLS reverse proxy, restrict direct port access at the firewall and persist logs/metrics. No host deployment is claimed until the endpoint is externally verified.

## I-CONNECT authentication
- Corporate Command and Automation Studio load the same sign-in layer.
- Browser sign-in uses Supabase Auth password flow with the public anon key returned by `/api/config`; only the public URL and anon key are exposed by that endpoint.
- Access and refresh tokens are held in browser `sessionStorage`, refreshed before expiry and cleared on sign-out. The workflow API independently validates each bearer token and checks active organisation membership and role.
- The application currently has no active organisation members. Provision the first owner using the guarded operator bootstrap below before expecting sign-in to succeed.

## Initial organisation-owner bootstrap
- The inspected Supabase project currently has one active organisation (`IZAKHONO`, slug `izakhono`) but no authentication users or active organisation memberships. Cloud workflow save/load therefore cannot be exercised until the first authorised owner account is provisioned.
- A guarded operator-only script is provided at `scripts/bootstrap-owner.js`; configure `I_CONNECT_BOOTSTRAP_ORG_SLUG=izakhono`, the Supabase service-role key, owner email/password and an explicit `I_CONNECT_CONFIRM_OWNER_BOOTSTRAP=YES` acknowledgement.
- The script refuses to run if the organisation already has an active member, does not expose a public bootstrap endpoint, and never prints the password or service-role key.
- Run it only from a trusted IZAKHONO-controlled environment using `npm run bootstrap:owner` in `products/i-connect`; do not commit the populated environment file.

## Unified inbox foundation
- Adds organisation-scoped contacts, provider identities, communication preference/lawful-basis records, inbox threads and message records.
- Composite foreign keys prevent a contact, channel connection or thread from being attached across organisation boundaries.
- Authenticated organisation members have read-only access under RLS. Writes are reserved for trusted server-side services until the inbox API enforces assignment, consent, suppression and audit rules. Communication-permission history is append-only: the service role can insert/read consent records but cannot update or delete them.
- Raw webhook events receive a 30-day expiry by default; inbox threads/messages receive 90-day expiry defaults. These are technical defaults, not a legal determination: set retention to IZAKHONO's approved schedule. A database cron job is now configured daily at 02:17 UTC to purge expired webhook events, inbox messages and threads; contact and consent records are not automatically erased. Message ingestion and outbound delivery remain disabled pending privacy review.
- The existing direct-message `conversations` and `messages` tables remain untouched because their current model is not organisation-scoped.

## WhatsApp Business webhook intake
- A Meta-compatible GET verification handshake is implemented at `/api/webhooks/whatsapp`.
- POST deliveries are verified against `X-Hub-Signature-256` using HMAC-SHA256 over the exact raw request bytes before payload processing.
- The adapter normalises inbound message and delivery-status events, resolves `metadata.phone_number_id` to exactly one active organisation channel connection and inserts events idempotently into the server-only webhook inbox.
- The endpoint only acknowledges and stores signed events. An opt-in server worker can transform signed inbound messages and delivery statuses into minimal tenant-scoped inbox records. It clears the raw event payload after successful processing, and does not send replies, start workflows or execute CRM/payment actions. The worker starts only when both `I_CONNECT_INBOX_PROCESSING_ENABLED=true` and `I_CONNECT_CUSTOMER_DATA_POLICY_APPROVED=YES` are explicitly configured alongside the service-role key.
- It is disabled by default. Enable only after an HTTPS endpoint, Meta app webhook subscription, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `I_CONNECT_SUPABASE_URL` and an active `ic_channel_connections` record are configured. The connection's `external_account_id` must equal the Meta phone-number ID.
- Review customer-data retention, POPIA notices/lawful basis and access controls before accepting real customer messages. Raw webhook payloads expire after 30 days by default and require a scheduled server-side purge. No Meta account credentials or secrets have been added to the repository.

## Workflow test execution
- Owner/admin/manager users can enqueue a manual test for a saved draft workflow. The queue is idempotent per organisation and key.
- The optional worker is enabled only with `I_CONNECT_WORKER_ENABLED=true` and the private `SUPABASE_SERVICE_ROLE_KEY` configured on the server.
- Each organisation is limited to 20 queued/running manual simulations. The queue uses an organisation-scoped transaction lock and the existing unique idempotency constraint.
- Abandoned worker claims are retried after ten minutes; after three claims they are marked failed rather than remaining stuck.
- Worker RPCs atomically claim queued manual tests and record terminal outcomes. The worker accepts only the `manual_test` trigger type.
- Simulation is intentionally side-effect free: it records the nodes visited and explicitly reports zero external actions executed.
- Live triggers, messaging, CRM writes, payments, arbitrary code and external tool execution are not supported by this test worker.

## Cloud workflow persistence
- `GET /api/automation/workflows` requires a valid Supabase access token and returns workflows only for an active organisation membership.
- `POST /api/automation/workflows` requires owner/admin/manager membership and saves a workflow plus immutable version graph atomically through `public.ic_save_workflow`.
- The API uses the Supabase anon key with the caller's bearer token so database RLS remains in force. It does not use the service-role key.
- The browser adapter reads the access token from the shared I-CONNECT sign-in session (`window.I_CONNECT_SESSION.access_token`) and retries once after refreshing an expired session.
- Workflow graph payloads are limited to 256 KB. Channel credentials are not accepted or stored by this endpoint.

## Agent assignment and human handover
- Agents can claim an unassigned conversation and release their own assignment.
- Assigned agents can move conversations to waiting-for-customer or reopen them.
- Owners, admins and managers can assign/unassign agents, close/reopen conversations, mark priority and route to an active organisation queue.
- Every handover action is written to the organisation audit log with before/after state.
- The database function verifies the actor's active membership and role, validates that the assignee is an active member of the same organisation, locks the conversation row, and rejects cross-tenant queue/thread references.

## Unified inbox application
- The new `inbox.html` workspace loads organisation-scoped conversation lists and message history through authenticated read-only endpoints.
- The UI uses text-safe DOM rendering for customer-controlled names and message bodies. It exposes claim/release and permitted status controls; no reply or channel-activation controls are available.
- Contact Centre navigation opens the Unified Inbox directly. Empty states distinguish missing organisation membership from an empty conversation queue.

## Static asset exposure controls
- The portable web server serves the browser UI but blocks direct HTTP access to server source, package manifests, operator scripts, tests, migration SQL, environment files, container metadata, source maps and repository metadata.
- Dotfiles are denied by the static file server. Browser assets remain available.

## Local validation
- Run `npm run check:syntax` in `products/i-connect` to check server, browser adapter and bootstrap script syntax.
- Run `npm run test:workflow-engine` in `products/i-connect` for workflow simulation and WhatsApp webhook adapter tests.

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
