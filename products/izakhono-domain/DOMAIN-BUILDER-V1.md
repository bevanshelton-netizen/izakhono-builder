# IZAKHONO DOMAIN BUILDER™ — V1

## Purpose

Build and operate the IZAKHONO private naming root without purchasing a commercial Internet domain.

The first namespace is:

- `izakhono`
- `bevan@izakhono`
- `mail.izakhono`
- `webmail.izakhono`
- `cloud.izakhono`
- `pay.izakhono`
- `nav.izakhono`
- `voice.izakhono`

## Important boundary

`izakhono` is an IZAKHONO private namespace, not a registered public DNS domain. It can be resolved by an IZAKHONO-controlled resolver, but ordinary public Internet resolvers will not resolve it.

No domain purchase is performed by this builder.

## Architecture

```text
IZAKHONO IDENTITY
       |
       v
IZAKHONO DOMAIN AUTHORITY
       |
       +--> Zone: izakhono
       |
       +--> CoreDNS authoritative resolver
       |
       +--> Service records
       |      mail.izakhono
       |      webmail.izakhono
       |      cloud.izakhono
       |      pay.izakhono
       |      nav.izakhono
       |      voice.izakhono
       |
       +--> IZAKHONO MAIL
       |
       +--> Future Public Bridge
```

## V1 zone policy

The authoritative zone is stored as infrastructure code and must be reproducible on an IZAKHONO node.

Initial records:

- `NS ns1.izakhono.`
- `ns1.izakhono` → private resolver address
- `mail.izakhono` → mail service
- `webmail.izakhono` → webmail service
- `smtp.izakhono` → mail service
- `imap.izakhono` → mailbox service
- `identity.izakhono` → identity service
- `cloud.izakhono` → cloud service
- `pay.izakhono` → payment service
- `nav.izakhono` → navigation service
- `voice.izakhono` → voice service

## Resolver requirements

The production resolver is CoreDNS. The Node DNS prototype is not considered production infrastructure.

The resolver must support:

1. Authoritative `izakhono` zone resolution.
2. Internal service discovery.
3. Deterministic zone configuration.
4. Health checking.
5. Logging/audit capability.
6. No dependency on Vercel.
7. No paid DNS provider requirement for private namespace operation.

## Domain Builder contract

A future provisioning call should be able to request:

```text
createNamespace("izakhono")
createService("mail", target)
createService("webmail", target)
createService("cloud", target)
createService("pay", target)
createService("nav", target)
createService("voice", target)
validateNamespace("izakhono")
```

The builder must produce the zone configuration, validation report and deployment manifest. It must not claim public DNS delegation unless public delegation evidence exists.

## Public bridge

The private root is deliberately separated from the future public bridge. A later public bridge may use a registered domain or another interoperable naming system, but the internal namespace remains `izakhono`.

The bridge must never change the canonical internal identity from `bevan@izakhono`.

## Acceptance criteria

The domain layer is considered runtime-ready only when an IZAKHONO node demonstrates:

- `mail.izakhono` resolves through the IZAKHONO resolver.
- `webmail.izakhono` resolves through the IZAKHONO resolver.
- `bevan@izakhono` is recognized by the identity authority.
- Mail services can resolve each other through the private namespace.
- Resolver restart preserves the zone.
- The same namespace can be rebuilt from repository-controlled configuration.

It is **not** considered a public Internet domain until an actual public delegation and external resolver test are completed.
