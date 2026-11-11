# IZAKHONO CONNECT AI — Automation Studio

## Product direction
Extend I-CONNECT's contact-centre and corporate customer platform with a Manychat-class customer engagement and marketing automation layer. The product is not a clone: workflows should connect conversations to CRM, service operations, quotations, bookings, payments and measurable outcomes.

## Current delivery in this branch
- Adds an Automation Studio entry to the I-CONNECT Corporate Command navigation.
- Adds a responsive, interactive workflow canvas.
- Adds prompt-to-workflow draft generation for lead qualification, product enquiries, appointments and support triage.
- Adds editable trigger/action steps, local draft save and a simulated test run.
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
This branch does not claim a live WhatsApp/Meta/TikTok integration, persistent cloud workflow storage, AI model execution, payment execution, or production readiness. Local browser storage is used only to demonstrate draft interactions.
