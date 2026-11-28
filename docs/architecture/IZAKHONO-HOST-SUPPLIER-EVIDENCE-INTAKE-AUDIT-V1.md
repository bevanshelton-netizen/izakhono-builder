# IZAKHONO HOST — Supplier Evidence Intake and Audit Trail v1

**Status:** Local evidence-management tooling; no supplier contact or approval.  
**Purpose:** Preserve the provenance, age, review outcome and integrity of each supplier statement used in a capability evaluation.

## Evidence record lifecycle

Each event concerns one exact supplier SKU and one requirement. Evidence is never silently overwritten. A correction, review, rejection, expiry or replacement is a new event linked to the same supplier/SKU/requirement; retain the prior event for audit history.

| Status | Meaning | Eligible to support a hard gate? |
|---|---|---|
| pending | Received but not independently reviewed | No |
| verified | Reviewed using an allowed independent method, with reviewer and source digest | Yes, subject to freshness and requirement fit |
| rejected | Reviewed and not accepted | No |
| superseded | Replaced by later evidence | No |
| expired | Evidence is past its validity date | No |

Supplier statements and marketing claims remain pending. Marking an event verified requires a reviewer, SHA-256 digest of the captured source artifact and a verification method other than supplier assertion. Permitted methods include document-authenticity check, independent confirmation, contract review and an observed test.

## Audit event fields

- Supplier ID, exact SKU and requirement ID.
- Event ID, sequence, UTC timestamps and event type.
- Claim/value, status, source type and source reference.
- SHA-256 of the captured evidence artifact (not a substitute for retaining that artifact securely).
- Verification method, reviewer, rationale and optional expiry.
- Previous-event hash and current-event hash.

The JSONL ledger is append-only through the provided command and uses a SHA-256 hash chain over canonical JSON. This detects edits and broken links within the ledger. A hash chain alone cannot detect deletion of the final events or replacement of the entire ledger. For stronger assurance, export and independently protect the latest head hash (for example, in a separately controlled audit system); no such external system is configured by this change.

## Use

Install the existing pinned dependency:

```sh
python -m pip install 'jsonschema==4.23.0'
```

Verify a local ledger:

```sh
python platform/validate/supplier_evidence_ledger.py verify --ledger /secure/local/path/supplier-evidence.jsonl
```

Append a reviewed event prepared as a local JSON file:

```sh
python platform/validate/supplier_evidence_ledger.py append \
  --ledger /secure/local/path/supplier-evidence.jsonl \
  --event /secure/local/path/reviewed-event.json
```

The append operation validates the current chain before writing, assigns sequence and predecessor hash, computes the event hash and refuses duplicate event IDs or an invalid existing ledger. Protect the ledger and source artifacts with appropriate access controls and encrypted backups. Do not commit supplier contracts, private emails, personal contact details, credentials or confidential evidence into the source repository.

## Evidence handling and boundaries

- The tool does not fetch URLs, send email, call provider APIs or upload source documents.
- `sourceReference` should be a controlled internal document reference or a public URL; do not put secrets or personal data in it.
- `sourceSha256` is the digest of the locally captured source artifact. Store the artifact separately in an approved, access-controlled location.
- Record capture time and expiry; stale evidence must be reviewed before reuse.
- Independent verification must match the precise SKU, region, product type, contract term and workload requirement being evaluated.
- A supplier email is evidence of what the supplier said, not proof that a network port or service works. Port, PTR, mail-delivery and recovery claims require independent confirmation or observed testing where applicable.
- The intake ledger is a provenance record, not a supplier score, selection, purchase order, deployment approval or production acceptance.
- No external supplier has been contacted and no evidence has been fabricated. The repository fixture is synthetic only.
