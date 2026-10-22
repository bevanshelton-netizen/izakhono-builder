# IZAKHONO DOMAIN RUNTIME

This package runs the private `izakhono` naming root with CoreDNS.

## Start

```bash
docker compose up -d resolver
```

## Validate configuration

```bash
node validate-domain.mjs
```

## Query the resolver

The default compose configuration binds DNS to `127.0.0.1:5353` so it is not accidentally exposed to the public Internet.

Example:

```bash
dig @127.0.0.1 -p 5353 mail.izakhono A
```

## Runtime boundary

A successful container start or configuration validation is not proof of public Internet availability. `izakhono` remains a private namespace until a separately designed public bridge and actual public delegation exist.

## Production activation

Before using this resolver as an IZAKHONO production dependency, run it on an approved IZAKHONO node, verify DNS queries, verify restart persistence, restrict network access, and record acceptance evidence.
