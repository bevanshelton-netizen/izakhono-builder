# IZAKHONO Business Email Identity Directive

**Status:** Portfolio-wide operating standard  
**Issued:** 25 September 2026  
**Operator:** IZAKHONO AFRICA (PTY) LTD

## Decision

Every public-facing IZAKHONO platform must have a professional platform-branded business email identity.

A separate paid mailbox is not required for each identity. Aliases, routing groups and shared infrastructure may be used provided that:

- the external sender identity is the correct platform;
- replies reach an authorised business mailbox or queue;
- records remain attributable to the correct legal entity and platform;
- SPF, DKIM and DMARC are configured for each sending domain;
- secrets and mailbox credentials are not shared across unauthorised staff;
- regulated or separately incorporated entities remain legally isolated;
- the underlying transport is replaceable.

## Required roles

Public platforms should expose, as applicable:

- primary business contact;
- support;
- partnerships;
- accounts;
- no-reply transactional sender.

## Legal entity boundary

A platform address does not change the contracting entity. Public websites and outbound mail must still identify the correct legal operator.

EDU-BUILD INSTITUTE – Shelton Campuses remains separate from IZAKHONO AFRICA and uses its own approved domain/identity.

UFCE-SA is not part of this IZAKHONO mail namespace and must not be silently routed through IZAKHONO commercial identities.

## Status language

An address is **DEFINED** when it exists in the registry.

An address is **ROUTED** when inbound delivery is configured.

An address is **AUTHENTICATED** when SPF, DKIM and DMARC pass.

An address is **LIVE VERIFIED** only after both external send and external reply tests pass.

Do not publish or advertise a business address as operational until it is LIVE VERIFIED.
