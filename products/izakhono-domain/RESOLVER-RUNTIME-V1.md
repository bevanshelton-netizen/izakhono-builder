# IZAKHONO DOMAIN RESOLVER™ — V1

## Status

Infrastructure specification and repository-controlled CoreDNS configuration. Runtime activation is evidence-gated and requires an actual IZAKHONO node.

## Resolver role

CoreDNS is the authoritative resolver for the private `izakhono` namespace. The resolver owns service discovery for the IZAKHONO internal universe and does not depend on Vercel or a paid DNS provider.

## Resolution model

```text
Client / IZAKHONO service
        |
        v
IZAKHONO Resolver
        |
        +-- izakhono authoritative zone
        |      +-- mail
        |      +-- webmail
        |      +-- smtp
        |      +-- imap
        |      +-- identity
        |      +-- cloud
        |      +-- pay
        |      +-- nav
        |      +-- voice
        |
        +-- public DNS forwarding for names outside izakhono
```

## Runtime contract

1. CoreDNS loads `coredns/Corefile`.
2. The authoritative zone is loaded from `coredns/izakhono.db`.
3. Internal service names resolve without public DNS.
4. Names outside `izakhono` may use configured upstream forwarding.
5. Resolver configuration remains reproducible from Git-controlled files.
6. Resolver health must be observable before the namespace is declared runtime-ready.

## Validation

Run:

```bash
node validate-domain.mjs
```

A successful validation proves repository configuration is structurally complete. It does **not** prove that a live node is running or reachable.

## Runtime acceptance

The namespace becomes runtime-ready only after an IZAKHONO node demonstrates successful DNS queries against the running CoreDNS instance for `mail.izakhono`, `webmail.izakhono`, `identity.izakhono`, `smtp.izakhono`, and `imap.izakhono`, plus resolver restart persistence.

## Security boundary

The private resolver must not be exposed as an unrestricted public recursive resolver. Authoritative `izakhono` resolution is separated from controlled forwarding for external names.

## Public interoperability

`izakhono` remains a private namespace. Public Internet interoperability requires a separate bridge and actual public delegation evidence. The canonical internal identity remains `bevan@izakhono`.
