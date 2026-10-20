# Mailbox provisioning contract

The mail engine provisions mailboxes from a typed manifest. Secrets are supplied at runtime and are never stored in the manifest.

Example:

```json
{
  "domain": "example.com",
  "mailboxes": [
    {"local": "info", "quota_mb": 2048},
    {"local": "projects", "quota_mb": 2048},
    {"local": "tenders", "quota_mb": 2048}
  ]
}
```

The resulting accounts are intended to support normal SMTP submission and IMAPS access. Passwords must be generated or supplied at provisioning time and delivered through a secure handover mechanism.

Provisioning must be idempotent: an existing mailbox is updated rather than duplicated, and a failed run must leave the domain/mailbox state explicitly `PENDING` rather than claiming success.
