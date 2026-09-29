# IZAKHONO Executive PA

Commercial executive-assistant control system for priorities, money, follow-ups, decisions, deadlines and WhatsApp delivery.

## What v0.1 does

- Captures and prioritises executive tasks.
- Separates TODAY, MONEY, PEOPLE WAITING FOR US, WE ARE WAITING FOR THEM, CEO DECISIONS, DEADLINES/MEETINGS and URGENT RISKS.
- Produces a WhatsApp-ready daily executive brief.
- Receives WhatsApp webhook messages and stores the conversation trail.
- Accepts WhatsApp capture commands: `TASK:`, `TODAY:`, `MONEY:`, `DECISION:`, `WAITING:`, `FOLLOWUP:` and `RISK:`.
- Responds to `BRIEF` with the current detailed brief during an active customer-service window.
- Sends business-initiated WhatsApp notifications with an approved template, avoiding unsafe out-of-window free-form sends.
- Keeps contracts, banking, payments, legal commitments and other binding decisions outside automatic execution.
- Uses the existing IZAKHONO D1 database through isolated `pa_*` tables and is portable across approved runtimes.

## Public route

Target route: `https://pa.izakhonoafrica.co.za`

Webhook callback after deployment:

`https://pa.izakhonoafrica.co.za/api/whatsapp/webhook`

## Required runtime secrets

Set these as Cloudflare Worker secrets; never commit them:

- `PA_ADMIN_SECRET`
- `PA_OWNER_WHATSAPP` — international digits only, for example `27...`
- `WHATSAPP_VERIFY_TOKEN`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_VERSION` — set to the currently supported Graph API version for the Meta app
- `WHATSAPP_ALLOWED_WA_IDS` — comma-separated WhatsApp IDs permitted to issue PA commands
- `WHATSAPP_BRIEF_TEMPLATE_NAME` — approved utility template used for scheduled brief notifications

Optional variables:

- `PA_OWNER_NAME`
- `WHATSAPP_TEMPLATE_LANGUAGE` (defaults to `en`)

## WhatsApp setup

1. Create or use a Meta Business portfolio with a WhatsApp Business Account and Cloud API app.
2. Add/verify the WhatsApp sender number.
3. Configure the callback URL above and use the exact `WHATSAPP_VERIFY_TOKEN` stored in the Worker.
4. Subscribe the app to WhatsApp message webhook events.
5. Store a long-lived/permanent production access token in `WHATSAPP_ACCESS_TOKEN` and the sender's phone-number ID in `WHATSAPP_PHONE_NUMBER_ID`.
6. Create and approve a utility template for the morning notification. The implementation expects two body variables: executive name and a compact status summary. A suitable wording is: `Good morning {{1}}. Your Executive PA brief is ready. {{2}} Reply BRIEF for the full list.`
7. Configure `WHATSAPP_BRIEF_TEMPLATE_NAME` to the approved template name.
8. Send `BRIEF` from the authorised WhatsApp number to verify two-way delivery. Then test `TASK: Call supplier` and confirm it appears on the dashboard.

## Daily brief policy

The Worker cron runs at `06:00 UTC`, which corresponds to `08:00` in Johannesburg year-round. It stores the full brief and sends the approved WhatsApp utility template. The user can reply `BRIEF` to receive the full free-form brief in the 24-hour service window.

## Commercialisation boundary

The schema is tenant-aware. The initial runtime uses one configured tenant (`izakhono`), while the tables and integration boundary allow additional tenants without mixing records. Before public resale, add customer authentication, subscription/billing, privacy/retention controls, onboarding, support tooling and tenant-specific WhatsApp sender policy as required.

## Safety and governance

- No API token or admin secret is returned by status endpoints.
- Inbound WhatsApp command execution can be restricted with `WHATSAPP_ALLOWED_WA_IDS`.
- Binding commitments are not automatically accepted or sent.
- All task creation, updates and WhatsApp events are auditable in `pa_audit_events`.
- The system follows IZAKHONO's owned-first, externally reversible infrastructure directive.
