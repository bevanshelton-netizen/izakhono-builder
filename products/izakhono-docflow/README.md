# IZAKHONO DOCFLOW

IZAKHONO DOCFLOW is the portfolio document-workflow engine for human-approved AI drafting.

It is designed to sit behind **IZAKHONO SUPER AI** for drafting and **FLOWIQ** for workflow orchestration while remaining independently deployable. External providers are adapters, not owners of the product.

## Core contract

1. A user describes the document in plain language.
2. DOCFLOW reuses known business fields and sends a structured drafting request to the SUPER AI adapter when available.
3. If the AI adapter is unavailable, DOCFLOW produces a deterministic working shell instead of fabricating a successful AI call.
4. Every document enters **review**.
5. Approval requires an explicit human confirmation.
6. "Approve & queue send" records a queue request only. It never claims delivery until a downstream workflow confirms delivery.
7. Every state change is written to an audit trail.

## v0.1 document types

- Non-Disclosure Agreement
- Business Proposal
- Quotation
- Service Level Agreement
- Employment Letter
- Supplier Agreement

## Data isolation

Every draft carries:

- `workspace_id`
- `legal_entity`

This keeps portfolio workflows from silently mixing different operating entities. Protected source data should stay in its source system; DOCFLOW stores only the document workflow record it needs.

## Adapter boundaries

### SUPER AI

Optional service binding: `SUPER_AI`

DOCFLOW now uses the real IZAKHONO SUPER AI trusted-workflow contract at `POST /api/v1/chat`.

The owner runtime supplies:

- `SUPER_AI_URL`
- `SUPER_AI_INTERNAL_KEY`
- `SUPER_AI_WORKFLOW_KEY`

DOCFLOW identifies itself as product `izakhono-docflow`, uses `access_mode: workflow`, keeps the data classification internal, and sends both the normal internal gateway key and the separate workflow key. It does not use subscriber credits for this owner-controlled workflow.

The drafting prompt explicitly forbids inventing material facts and requires placeholders plus human review. No provider-specific API key is committed to DOCFLOW source. If SUPER AI is unavailable or rejects the workflow, DOCFLOW falls back to a clearly labelled deterministic working draft.

### FLOWIQ

Optional service binding: `FLOWIQ`

DOCFLOW emits business workflow events such as:

- `docflow.draft_created`
- `docflow.approved`
- `docflow.approve_and_send_requested`

FLOWIQ can then coordinate e-signature, email, reminders, CRM updates and expiry/renewal tasks through replaceable adapters.

## Security

Set `DOCFLOW_ADMIN_SECRET` as a server-side secret. Write/read workflow routes other than public health/templates are closed when the secret is missing.

The engine does not autonomously sign agreements. AI output remains a working draft requiring human review. Legal documents should be reviewed by an appropriately qualified person before execution where the risk or transaction warrants it.

## Local validation

```bash
npm install
npm run validate
```

Before deployment, replace the placeholder D1 database id in `wrangler.jsonc`, apply `migrations/0001_docflow.sql`, configure the owner secret and bind approved SUPER AI / FLOWIQ services.

## Deployment status

**NOT YET PUBLIC**

The source package is independently deployable, but no public-live claim is made until the owned route or an approved external resilience route returns verified HTTPS 200 and the intended DOCFLOW experience is confirmed.
