# Data retention and POPIA implementation plan

This is an engineering control plan, not legal advice or a legal determination.

## Required processing register per workflow

Before a business activates a verification purpose, record:

- responsible party and operator roles;
- business purpose and necessity;
- data categories, including whether biometric or other special personal information is processed;
- applicable lawful basis and separate authorisation for special personal information where required;
- data subject notice version and evidence of consent where consent is the chosen basis;
- provider, subprocessors, hosting region and cross-border transfer path;
- access roles and recipient businesses;
- retention period and deletion trigger;
- data subject access, correction, objection and complaint handling;
- security controls and incident escalation contact.

## Data minimisation

- Use opaque tenant-scoped subject references in the application database.
- Do not store raw ID numbers in logs, audit metadata, URLs or analytics.
- Store document and face images only in a private encrypted object store.
- Store only encrypted object references, hashes, capture times and retention metadata in PostgreSQL.
- Keep provider payloads out of application logs; persist a normalised result and minimal reason codes.
- Do not share full identity evidence between subsidiaries when a purpose-bound result is sufficient.

## Retention and deletion

Retention periods must be approved for each purpose and legal obligation; there is no single default period for all businesses. The production system must support:

1. per-evidence retention expiry;
2. deletion queue with retries and failure alerting;
3. deletion from primary object storage and applicable replicas;
4. backup expiry policy and documented backup restore deletion reconciliation;
5. legal hold with authorised reason and review date;
6. deletion evidence without retaining the deleted personal data.

## Data subject rights and incidents

Provide verified request intake for access, correction, objection, deletion where applicable and complaint escalation. Maintain a documented incident response path and assess notification duties under POPIA and applicable regulations.

## Hard gate

No live identity documents or biometric data may be collected until the Information Officer approves the workflow register, privacy notice, lawful basis, special-personal-information authorisation, operator contracts, retention schedule, cross-border assessment and security controls.
