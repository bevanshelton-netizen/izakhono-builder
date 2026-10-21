# IZAKHONO Parallel Universe — Mail Engine

## Principle
Build the software ourselves and keep external infrastructure reversible. The private `izakhono` namespace is an internal identity namespace; public Internet interoperability remains a separate bridge.

## Components
- Identity Authority: stable IZAKHONO identities and credentials.
- Resolver: authoritative answers for the private `izakhono` namespace and normal forwarding for public DNS.
- Mail Core: message model, mailbox state, queues, delivery events and audit records.
- SMTP Submission/Relay: authenticated outbound submission and controlled server-to-server delivery.
- IMAP-compatible mailbox API: synchronization semantics for clients and webmail.
- Webmail Runtime: Inbox, Compose, Sent, Drafts, Archive, Junk, Trash, Contacts and Search.
- Public Bridge: maps an IZAKHONO identity to a publicly routable mail domain when one is available.

## First identity
`bevan@izakhono`

## Acceptance criteria
The system is not considered production mail until a real end-to-end test passes:

1. authenticate as `bevan@izakhono`;
2. compose a message;
3. submit it through the mail engine;
4. persist it in Sent;
5. deliver it to an external mailbox when a public bridge exists;
6. receive the reply;
7. persist the reply in Inbox;
8. display it in webmail;
9. preserve message identity during synchronization;
10. record security and delivery audit events.

## Security baseline
- TLS for network mail protocols.
- No unauthenticated open relay.
- Rate limiting and abuse controls.
- Passwords stored only as secure password verifiers.
- Secrets excluded from source control.
- DKIM/SPF/DMARC support belongs to the public-domain bridge, not the private namespace itself.

## Infrastructure boundary
This repository contains the software/control plane. It does not claim to provide public DNS, public IP addressing, SMTP reachability, or public mail reputation. Those are deployment dependencies and must be verified separately.
