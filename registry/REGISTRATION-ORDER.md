# IZAKHONO REGISTRATION ORDER

Registration orders are the customer-handover control record.

## State model

`pending` → `authorityConfirmed` → `dnsPublished` → `dnsVerified` → `rdapVerified` → `readyForHandover` → `handedOver`

An order must never be marked `handedOver` unless authoritative registration, DNS verification, and RDAP verification are all confirmed.

## Commercial gate

Customer-facing paid registration remains disabled until a real authoritative registrar path is configured and end-to-end verified.

The order record is an operational control layer; it does not itself create public domain authority.
