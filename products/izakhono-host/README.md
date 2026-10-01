# IZAKHONO HOST v0.1

IZAKHONO HOST is the owned-first customer hosting control plane for domains, websites, SSL, DNS, email and billing.

## v0.1 scope

- customer onboarding
- domain inventory
- site inventory
- service plans
- provisioning jobs
- DNS record plans
- SSL status tracking
- business mailbox inventory
- invoices and payment status
- audit events
- operator dashboard
- safe provider adapters

The first production customer is !XQWAXQWAMILÉ HOLDINGS (PTY) LTD / `xqwaxqwamile.com`.

## Infrastructure rule

**Owned-first, externally reversible.**

Provider integrations are adapters. Customer state is owned by IZAKHONO HOST. Provider credentials never belong in browser code.

Cloudflare is the intended registrar/DNS adapter. Vercel is an external deployment adapter for the current Calvin site while the owned runtime is prepared.

## Security

No customer can execute arbitrary infrastructure commands from the browser. Provisioning is represented as typed jobs and provider adapters. Production secrets are server-side only.

## Status vocabulary

- `planned`
- `queued`
- `running`
- `verified`
- `failed`
- `paused`

A service is not marked live without verification evidence.
