# IZAKHONO MAIL — CORE V1

## Purpose
Native IZAKHONO mail software. This is the control-plane/mail-domain layer; public Internet delivery is an adapter and deployment concern.

## Core model

### Identity
- `identity_id`
- canonical address
- display name
- status
- credential reference
- mailbox reference
- created/updated timestamps

### Mailbox
- `mailbox_id`
- owner identity
- quota
- folders: INBOX, SENT, DRAFTS, ARCHIVE, JUNK, TRASH
- UIDVALIDITY per mailbox
- retention policy

### Message
- immutable `message_id`
- RFC-style Message-ID when transported externally
- mailbox/folder association
- sender/recipient envelopes
- headers
- MIME body reference
- attachment references
- received/sent timestamps
- flags
- delivery state

### Queue
States:
`queued → processing → delivered | deferred | failed`

Deferred delivery must use bounded retries with exponential backoff. Permanent failures become explicit delivery failures; they must never silently disappear.

## Interfaces

### Identity API
- create identity
- authenticate identity
- rotate credentials
- disable/enable identity
- bind identity to mailbox

### Mail API
- create draft
- submit message
- list mailbox
- fetch message
- set flags
- move message
- delete/restore message
- search mailbox

### Transport adapter
- SMTP submission adapter
- SMTP delivery adapter
- inbound SMTP adapter

Transport adapters are replaceable. The mailbox/message model must not depend on a particular provider.

## Security
- no plaintext passwords
- credentials represented only by secure password verifiers or external identity references
- encrypted secrets at rest
- TLS for network transport
- authenticated submission
- strict sender authorization
- rate limits
- anti-open-relay controls
- immutable security/audit events
- no secrets in repository

## Acceptance tests
1. Create `bevan@izakhono` in the private identity authority.
2. Create its mailbox and standard folders.
3. Authenticate successfully.
4. Create and persist a draft.
5. Submit a message and persist it in SENT.
6. Process a local delivery into INBOX.
7. Fetch the message and verify stable identifiers.
8. Reply and verify the reply lifecycle.
9. Verify audit events for authentication and delivery.
10. Verify unauthorized sender/relay attempts are rejected.

## Public bridge boundary
The core does not claim public Internet delivery until a deployment node has verified public IP reachability, DNS/MX, reverse DNS where required, TLS certificates, outbound connectivity, and successful external send/receive tests.
