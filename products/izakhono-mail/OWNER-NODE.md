# IZAKHONO MAIL — OWNER NODE STACK

This stack is the private first deployment of the IZAKHONO Parallel Universe mail namespace.

## Identity

- `bevan@izakhono`
- `mail.izakhono`
- `webmail.izakhono`
- `smtp.izakhono`
- `imap.izakhono`
- `identity.izakhono`
- `cloud.izakhono`

The `.izakhono` namespace is private/alternative naming. It is **not** a public Internet domain and must not be represented as one until a public DNS bridge is actually configured and verified.

## Services

`docker-compose.yml` starts:

1. CoreDNS authoritative private zone
2. IZAKHONO outbound mail API/relay
3. Inbound SMTP receiver
4. Mailbox API
5. Webmail
6. Shared persistent SQLite mailbox storage

All host ports bind to loopback by default. Nothing in this stack makes the private namespace publicly reachable.

## One-command activation

On NODE 01:

```bash
./START-IZAKHONO-MAIL.sh
```

The launcher checks Docker, creates a local `owner.env` from the example when absent, builds the services, starts them, and waits for health endpoints.

## Outbound public mail boundary

The mail engine already supports authenticated SMTP submission through the owner-controlled environment variables in `owner.env`.

Public delivery is only claimed after a real SMTP relay is configured and an end-to-end test proves acceptance. Until then, the system truthfully remains `awaiting_smtp` for public outbound delivery.

## Public bridge boundary

A future IZAKHONO EDGE/public bridge must provide:

- public DNS/MX for a registered domain or another interoperable public namespace
- SMTP port 25/587 reachability as required
- TLS certificates
- SPF, DKIM and DMARC
- abuse/rate controls
- verified send and receive tests

No commercial domain is purchased by this stack.
