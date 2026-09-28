# IZAKHONO SIGN

IZAKHONO SIGN is the independent document-delivery and electronic-acceptance engine for IZAKHONO DOCFLOW.

## Architecture

**DOCFLOW → FLOWIQ → IZAKHONO SIGN**

DOCFLOW remains the source of truth for the approved document. SIGN stores the envelope state, document SHA-256 hash, recipient routing metadata and signature audit record. It does not copy the document body into its database.

FLOWIQ sends only the DOCFLOW draft reference. SIGN then retrieves the approved delivery payload directly from DOCFLOW through the private service-authenticated API.

## Security model

- internal action API requires `SIGN_API_TOKEN`
- signing links use HMAC-SHA256 tokens derived from `SIGN_LINK_SECRET`
- only the token hash is stored in the database
- links expire after a configurable number of days (30 by default)
- the document hash is verified again before display and before signature completion
- a document changed after envelope creation is rejected instead of silently signed
- DOCFLOW service access uses a separate `DOCFLOW_SERVICE_TOKEN`
- raw document bodies are not persisted in SIGN
- raw recipient email is needed for routing; audit entries use a hash where practical
- no behavioural tracking or advertising identifiers

## Electronic signature record

When a signature is required, the signer must type their name and explicitly confirm intent. SIGN records:

- envelope ID
- DOCFLOW draft ID
- document SHA-256
- signer name
- UTC timestamp
- a SHA-256 of the user-agent string
- immutable-style audit events in the SIGN ledger

This is an electronic acceptance record. It is not represented as satisfying every special signature form or every jurisdiction-specific requirement.

## Truthful delivery states

SIGN distinguishes:

- `awaiting_public_route` — the signing service is not publicly reachable yet
- `link_ready` — a secure link can be generated
- `awaiting_mail` — the link exists but no outbound mail adapter is configured
- `dispatched` / `outbound_accepted` — the outbound mail adapter accepted the message
- `signed` — the recipient completed the signature action

An outbound mail server accepting a message is not described as proof that the recipient read it.

## APIs

Internal:

- `GET /healthz`
- `GET /readyz`
- `POST /v1/actions` — FLOWIQ delivery action
- `GET /v1/envelopes` — owner/internal envelope ledger

Public signing route once EDGE/TLS/DNS are verified:

- `GET /sign/:token`
- `POST /sign/:token/complete`

## NODE01

The owner launcher:

`owner-node/START-IZAKHONO-DOCFLOW-CHAIN.cmd`

packages and verifies the private chain:

**IZAKHONO CODE → CONTROL → NODE01 → CRM + SIGN + FLOWIQ + DOCFLOW**

FLOWIQ reaches CRM and SIGN on the owner-controlled `izakhono-internal` Docker network. SIGN reaches DOCFLOW on the same private network.

The public SIGN hostname and outbound mail adapter are separate activation gates and are not claimed live until independently verified.
