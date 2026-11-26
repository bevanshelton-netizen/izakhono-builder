# IZAKHONO CONVERSATION HUB
## Unified customer communications and AI-assisted service architecture — V1

**Product authority:** IZAKHONO COMMUNICATIONS  
**Experience:** Conversation Hub  
**Status:** Architecture and pure domain contracts; not production-enabled  
**Market entry:** South Africa first; global-ready  
**Ownership principle:** IZAKHONO-owned core, replaceable channel adapters

## 1. Product decision

IZAKHONO CONVERSATION HUB is the shared customer conversation workspace and orchestration layer across the IZAKHONO ecosystem. It absorbs the useful capabilities demonstrated by Respond.io—unified inbox, multi-channel replies, AI agents, lead qualification, routing, CRM context, analytics and human handover—and extends them into an owned business workflow engine.

This is not a new CRM, payment platform, identity provider, social network, PBX or customer database. It is the conversation and interaction layer that coordinates those canonical systems.

### Existing portfolio boundaries

- **IZAKHONO COMMUNICATIONS** owns shared conversation orchestration, message envelopes, routing policy, channel adapters, delivery evidence and conversation-level analytics.
- **I-CONNECT** remains the contact-centre, corporate voice, queue, agent desktop, carrier-neutral voice and connectivity operating product. It consumes the shared conversation capability; it is not duplicated.
- **IZAKHONO CONNECT** remains the customer-facing internet messaging and calling application. Its existing direct/group messaging, realtime, offline outbox and receipts are not rebuilt here.
- **IZAKHONO CRM** remains authoritative for contacts, organisations, opportunities, pipelines, activities and commercial relationship history. The Hub stores references and conversation activity, not a shadow CRM.
- **FORTRESS** remains authoritative for identity, session verification, membership, authorisation, tenant isolation, device trust, policy and audit.
- **IZAKHONO AI Gateway / AI Workforce** supplies model routing and agent execution. The Hub defines conversation-specific tool permissions, confidence gates, escalation and evidence requirements.
- **IZAKHONO PAY** remains authoritative for payment intents, verified financial events, ledger, refunds and reconciliation. A conversation may link to a payment record but cannot declare a payment successful.
- **IZAKHONO BOOKING / product systems** remain authoritative for appointment availability, booking creation and fulfilment. The Hub can initiate a confirmed action through a permissioned adapter.
- **CREATOR / content systems** remain authoritative for approved media assets and rights provenance.

## 2. What we absorb and improve

| Benchmark capability | IZAKHONO implementation |
|---|---|
| WhatsApp, Instagram, Messenger, TikTok, email and web chat in one inbox | One canonical conversation model with provider-neutral adapters and channel capability declarations |
| AI replies and lead qualification | Governed AI agents with approved knowledge, confidence thresholds, explicit tool scopes and auditable decisions |
| Human handover | Context-preserving handover with reason, queue, urgency, SLA clock and ownership |
| Team assignment and routing | Skills, language, business hours, priority, workload and tenant-scoped queue routing |
| CRM context | Live references to CRM contacts, organisations, deals and activities; CRM remains the source of truth |
| Campaign/ad attribution | Consent-aware source and campaign attribution with evidence and attribution windows |
| Team performance dashboard | Evidence-backed response, resolution, conversion, queue and quality metrics |
| Multiple branches and brands | Entity/platform/organisation/branch scope with FORTRESS-enforced access |
| Calls and email alongside chat | Shared interaction timeline; I-CONNECT voice and IZAKHONO MAIL adapters remain separate service authorities |
| Automation | Event-driven workflows with idempotency, approval gates, retry limits and an exception queue |

## 3. Core product surfaces

1. **Unified Inbox** — conversation list, channel identity, customer context, message timeline, assignment, tags, priority and search.
2. **Customer 360 context panel** — CRM contact/organisation/deal references, previous interactions, consent, open orders/bookings and support history, each fetched from its canonical owner.
3. **AI Agent Studio** — agent purpose, approved knowledge sources, language, business rules, tool permissions, confidence threshold, escalation policy and evaluation results.
4. **Team Desk** — agent presence, queue membership, assignment, workload, internal notes, mentions and supervisor takeover.
5. **Journey & Automation Builder** — trigger, conditions, authorised actions, delays, idempotency, consent check, human approval and stop conditions.
6. **Campaign Attribution** — click-to-chat source, campaign identifiers, conversion events and source freshness; no unsupported attribution claims.
7. **Supervisor Command Centre** — queue depth, first response, resolution, reopen rate, AI containment, human takeover, conversion and SLA breach.
8. **Channel & Integration Control** — adapter capability, connection state, credential reference, webhook health, rate limits, provider errors and last verified event.
9. **Customer self-service** — web chat, secure customer portal, FAQs, service requests and consent controls.
10. **Developer Gateway** — signed webhooks, versioned APIs, SDK contracts and event subscriptions.

## 4. Conversation and message model

A conversation belongs to exactly one tenant scope and has a stable IZAKHONO ID. A channel thread identifier is stored as a provider-scoped external reference, never as the canonical identity.

A conversation can include:
- customer and authorised staff participants;
- one or more channel identities linked under an approved identity-resolution policy;
- inbound/outbound message envelopes and immutable provider event references;
- assignments, queue membership, tags, priority and SLA clocks;
- AI runs, confidence, knowledge citations and tool-call records;
- human handovers and internal notes;
- CRM references, campaign attribution and permitted business-action references;
- consent, retention and legal-hold references.

Do not automatically merge two people because their names match. Phone/email matching must follow an explicit, auditable identity-resolution policy and handle shared numbers, recycled numbers, aliases and household accounts.

Message states are evidence-specific: `queued`, `attempting`, `accepted_by_channel`, `delivered`, `read`, `failed`, `unknown`, and inbound `received`. A provider API accepting a request is not proof of delivery; delivery is not proof that a human read it; read is not proof of understanding. Unknown outcomes are reconciled before retry to prevent duplicate sends.

## 5. Channel adapter contract

Adapters are replaceable transport bridges. The canonical conversation/message model remains IZAKHONO-owned.

Initial adapter roadmap:
- WhatsApp Business Platform;
- Instagram Messaging and Facebook Messenger;
- TikTok messaging where the official account/product permissions permit it;
- IZAKHONO MAIL / email;
- IZAKHONO CONNECT in-app messaging;
- IZAKHONO web chat;
- SMS and voice through separately approved providers / I-CONNECT.

Each adapter declares supported capabilities rather than pretending every channel supports the same features: inbound/outbound text, media, templates, reactions, read receipts, delivery receipts, typing, group messaging, voice, interactive forms, identity hints, edit/delete and retention. The UI and workflows must respect the declared capability set.

Every adapter must implement:
- signed webhook verification, replay protection and event deduplication;
- provider event ID and tenant-scoped idempotency;
- safe normalisation into canonical message envelopes;
- server-side secret references only;
- rate-limit handling and bounded retry/backoff;
- delivery/receipt evidence and reconciliation;
- opt-out, block and suppression propagation;
- provider health and last-successful-event reporting;
- disconnect, credential rotation and data-export/deletion procedures.

No unofficial scraping, browser automation against consumer accounts, session-cookie collection or circumvention of platform rules. Use official APIs and permitted product capabilities. An unconnected adapter is visibly **Not connected**, not simulated as live.

## 6. AI workforce governance

AI agents can:
- answer approved, low-risk FAQs using cited, versioned knowledge;
- detect intent, language, sentiment and urgency;
- qualify leads against tenant-defined criteria;
- summarise conversations and prepare handover briefs;
- draft responses and follow-up suggestions;
- recommend next steps and create CRM activity proposals;
- initiate a permitted booking or order workflow only after explicit customer confirmation and an authorised product adapter response.

AI agents cannot independently:
- promise refunds, approve credit or change prices outside policy;
- move money, confirm payment, issue refunds or change entitlements;
- change identity, permissions, security settings or regulated decisions;
- make medical, legal, financial or other high-impact determinations;
- fabricate stock, availability, policy, delivery or product claims;
- impersonate a human or conceal that an automated agent is speaking where disclosure is required;
- continue messaging after opt-out, blocked status or revoked consent.

Every AI turn records agent/version, model route, policy version, input/output references, confidence, cited knowledge references, tool requests/results, decision and escalation reason. Do not retain chain-of-thought; retain concise decision evidence and operational traces only.

### Human handover

Mandatory handover triggers include explicit request for a person, low confidence, repeated failed answers, complaint/dispute, sensitive topic, safety concern, policy boundary, tool failure or customer-defined escalation. Handover preserves the full permitted conversation context, summary, customer intent, attempted actions and unresolved questions. The AI stops sending until the handover policy explicitly permits it to resume.

## 7. Consent, privacy and messaging policy

- Maintain channel- and purpose-specific consent / lawful-basis evidence, source, timestamp, scope, expiry and revocation.
- Distinguish transactional/service messages from direct marketing; do not infer marketing consent from an existing customer relationship without checking the applicable legal basis.
- Enforce channel-specific windows, approved templates, sender identity and recipient opt-out requirements at send time.
- Apply POPIA and other applicable laws, platform terms and sector-specific obligations.
- Minimise personal data in message previews, notifications, logs, analytics and AI context.
- Support access, correction, export, deletion, retention schedules, suppression and legal holds.
- Do not use conversation content to train models by default; any permitted use requires an explicit, documented policy and lawful basis.
- Sensitive sectors require stricter tenant policies and may disable AI processing or specific channels entirely.

## 8. Routing, SLAs and workforce operations

Routing may consider tenant, brand, branch, queue, topic, language, customer tier, urgency, operating hours, agent skills, availability and current workload. Routing decisions are explainable and auditable.

Queue controls include:
- priority and age-based ordering;
- capacity and concurrency limits;
- assignment expiry and reassignment;
- overflow queues and business-hours rules;
- escalation timers and supervisor alerts;
- agent pause, wrap-up and after-contact work;
- workload fairness and protected breaks;
- VIP handling only where the tenant has an approved rule.

SLA clocks use tenant-configured business calendars and time zones. Pause conditions must be explicit. Report first response, next response, resolution and reopen time separately; never hide waiting-on-customer or provider delay without showing the rule.

## 9. Analytics and commercial truth

Every KPI must declare its definition, source, time window, timezone, tenant scope, exclusions, freshness and denominator.

Core measures:
- inbound volume by channel and source;
- first human / AI response time, separately;
- median and percentile response times;
- resolution time, backlog age and reopen rate;
- missed/abandoned conversations;
- AI-assisted, AI-resolved and human-takeover counts;
- lead qualification and CRM opportunity conversion;
- booked appointments, orders and collected revenue only from canonical systems;
- agent workload, quality review and SLA compliance;
- provider delivery failures, latency and adapter availability.

Never claim revenue uplift, conversion improvement or response-time reduction without a baseline, comparable cohort, defined measurement window and source evidence. Demo/simulated data must be labelled and excluded from commercial dashboards.

## 10. Security and architecture

Web/mobile clients
→ owned API gateway
→ FORTRESS identity/session/policy verification
→ tenant-scoped conversation services
→ event bus / transactional outbox
→ channel adapter workers / AI Gateway / CRM / PAY / I-CONNECT / MAIL / booking systems
→ owned persistence and evidence store.

Mandatory controls:
- server-side FORTRESS authorisation on every read, write, search, export, tool call and webhook action;
- entity_id + platform_id and, where applicable, organisation_id / branch_id scope;
- default-deny cross-tenant access and resource-level membership checks;
- service identities with narrow scopes and rotation;
- signed webhooks, replay protection, deduplication and bounded retries;
- encryption in transit and at rest, short-lived secrets and audited access;
- data retention, deletion and export controls;
- abuse, spam, fraud, rate and content safety controls;
- immutable audit/event references and incident response;
- no secrets or full sensitive payloads in logs.

The Hub must not create local authentication or bypass FORTRESS. CRM, PAY, MAIL, I-CONNECT, booking and content systems remain authoritative for their domains.

## 11. Current integration truth and release boundary

A read-only check on 26 November 2026 found the iZap account has one business, **IZAKHONO AFRICA**, with no WhatsApp numbers linked. Its WhatsApp connection is disconnected; no live inbound webhook or successful outbound message is evidenced. This architecture therefore treats iZap as a possible replaceable adapter, not as a currently operational channel. Do not run registration, reconnect, change account settings or send messages without explicit approval.

The existing I-CONNECT API already specifies a conversations/messages contract and the IZAKHONO CONNECT product already has an internet messaging foundation. Implementation must extend and reuse those systems rather than create duplicate inboxes or messaging databases.

No migrations, runtime endpoints, new provider accounts, credentials, channel registrations, outbound campaigns, paid services, hosting spend or production deployment are part of this V1 architecture/contract change.

## 12. Delivery plan and acceptance gates

**Stage 1 — domain and security contracts**
- Canonical conversation/message/adapter/agent/handover types.
- Tenant-scope, idempotency, consent, message evidence and AI action guards.
- Deterministic tests for isolation and prohibited actions.

**Stage 2 — integration inventory**
- Map current I-CONNECT conversations, IZAKHONO CONNECT, CRM outbox, FORTRESS session/policy, AI Gateway and MAIL interfaces.
- Select the canonical persistence owner and event delivery path.
- No new database until existing schema, RLS and ownership are inspected.

**Stage 3 — owned inbox experience**
- Agent workspace, queues, customer context, internal notes and supervisor views.
- Use real connected data only; disconnected channels remain visibly unavailable.

**Stage 4 — adapters and AI**
- One official channel at a time, starting with the first approved and operational channel.
- AI starts in suggest/draft mode; guarded auto-reply follows evaluation, tenant approval and human fallback tests.

**Stage 5 — business workflow**
- CRM lead and activity sync; booking/order actions through their authoritative systems; PAY status read-only from canonical verified events.

**Stage 6 — pilot readiness**
- POPIA/legal review, security review, cross-tenant tests, webhook replay tests, message reconciliation, delivery evidence, operational runbooks, backup/restore and invited-customer acceptance.

Definition of done requires executable implementation, passing automated and integration tests, verified provider evidence where relevant, security/privacy review and owner-approved production release. A merged PR or successful preview is not a production launch.
