# IZAKHONO BUSINESS EMAIL PLATFORM — V1

## Decision

Business email is a first-class IZAKHONO HOST workload. Every verified customer/platform domain gets domain-native mail through the same provisioning control plane used for hosting, DNS, TLS, billing and tenant management.

Gmail is an interface option only; it is not the underlying mail infrastructure.

## Platform architecture

```text
CUSTOMER / PLATFORM
        |
        v
IZAKHONO HOST CONTROL PLANE
  - tenant/domain registry
  - mailbox + alias provisioning
  - DNS orchestration
  - SPF / DKIM / DMARC
  - TLS / webmail
  - billing + plan entitlement
        |
        +--------------------+
        |                    |
        v                    v
IZAKHONO MAIL           IZAKHONO DNS/EDGE
  SMTP / IMAP / webmail    MX / SPF / DKIM / DMARC
        |
        v
BACKUP + FORTRESS + MONITORING
```

## Standard mailbox policy

Each verified domain can provision:

- `info@domain`
- `admin@domain`
- `sales@domain`
- `support@domain`
- `finance@domain`
- `projects@domain`
- `tenders@domain`
- `noreply@domain`

Aliases route to an approved mailbox without creating duplicate storage unless the tenant explicitly requests a separate mailbox.

## Platform domains already established

### IZAKHONO AFRICA
`izakhonoafrica.co.za`

Primary mailbox:
- `bevans@izakhonoafrica.co.za`

Standard departmental addresses:
- `info@izakhonoafrica.co.za`
- `sales@izakhonoafrica.co.za`
- `support@izakhonoafrica.co.za`
- `admin@izakhonoafrica.co.za`
- `finance@izakhonoafrica.co.za`
- `projects@izakhonoafrica.co.za`
- `tenders@izakhonoafrica.co.za`

### EDU-BUILD INSTITUTE
`edubuildshelton.org.za`

Primary public mailbox:
- `info@edubuildshelton.org.za`

Standard operational aliases/mailboxes:
- `admissions@edubuildshelton.org.za`
- `students@edubuildshelton.org.za`
- `finance@edubuildshelton.org.za`
- `admin@edubuildshelton.org.za`
- `support@edubuildshelton.org.za`

### ALLEGRO VIBEZ
`allegrovibez.com`

Primary public mailbox:
- `info@allegrovibez.com`

Standard operational aliases/mailboxes:
- `artists@allegrovibez.com`
- `media@allegrovibez.com`
- `bookings@allegrovibez.com`
- `support@allegrovibez.com`
- `admin@allegrovibez.com`

### KORA NETWORK / KORA STREAM AFRICA
`streamkoraafrica.com`

Primary public mailbox:
- `info@streamkoraafrica.com`

Standard operational aliases/mailboxes:
- `advertising@streamkoraafrica.com`
- `partnerships@streamkoraafrica.com`
- `content@streamkoraafrica.com`
- `support@streamkoraafrica.com`
- `finance@streamkoraafrica.com`
- `admin@streamkoraafrica.com`

## Future verified domains

Domains for I-CONNECT, FORTRESS, FAISReady, DOXA-SURE and other IZAKHONO products are provisioned only after their actual domain is verified in the domain registry. Do not fabricate a domain or claim a mailbox exists before DNS and mail acceptance evidence is recorded.

## Hosting integration

IZAKHONO HOST must expose one provisioning operation that can perform:

1. Register/verify tenant.
2. Register or attach domain.
3. Configure DNS.
4. Create mail tenant.
5. Create requested mailboxes and aliases.
6. Generate DKIM identity.
7. Publish SPF, DKIM and DMARC records.
8. Provision TLS for webmail/mail endpoints.
9. Create SMTP/IMAP credentials securely.
10. Attach backup policy.
11. Attach FORTRESS/security policy.
12. Attach monitoring and delivery-health checks.
13. Record immutable provisioning evidence.
14. Return customer webmail/login and mail-client settings.

The customer should experience this as one action: **Activate Business Email**.

## Mail endpoints

The canonical mail hostname should be tenant/domain aware. Until the owned mail edge is promoted, external mail infrastructure may act as a reversible capacity adapter. The control plane must not describe that provider as owned infrastructure merely because it is configured.

Recommended service roles:

- `mail.<domain>` — SMTP/IMAP/mail services where tenant DNS permits.
- `webmail.<domain>` — browser mail interface.
- `autodiscover.<domain>` — client configuration where supported.
- `autoconfig.<domain>` — client configuration where supported.

## Security gates

Every activated domain must have:

- MX records verified.
- SPF verified.
- DKIM verified.
- DMARC published and verified.
- TLS certificate verified.
- SMTP authentication enabled.
- IMAP authentication enabled where offered.
- brute-force/rate-limit protection.
- mailbox backup policy.
- audit/provisioning evidence.
- FORTRESS security gate.

No password is committed to Git or stored in plain configuration.

## Acceptance contract

A mailbox is **configured** only when the provisioning transaction completes.

A mailbox is **verified** only when DNS, TLS and mail-flow tests pass.

A domain is **production-ready** only when all required mail acceptance evidence is recorded.

Never claim that an email address is live merely because it appears in a configuration file or website footer.

## Ownership model

IZAKHONO owns the control plane, provisioning logic, tenant model, policy, evidence and customer experience. Mail transport/storage may initially use an external provider as a reversible capacity adapter until IZAKHONO MAIL is promoted on an eligible Software NODE.

This follows the IZAKHONO owned-first rule without blocking customers while the owned mail runtime is being completed.
