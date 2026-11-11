# FORTRESS Governance Decision Closure

Defensive reference layer for governance decisions.

Lifecycle:

`GOVERN → JOURNAL → RECEIPT → EVIDENCE-BIND → VERIFY → CLOSE`

Controls:
- tenant-scoped decision journal
- deterministic SHA-256 decision identity
- chained journal integrity
- cryptographic approval receipts
- decision/receipt/evidence binding
- end-to-end closure digest
- fail-closed verification

Production boundary: this layer does not provide production IAM, durable transactional storage, key management, encryption at rest, network delivery, credential handling, or external side effects. Those controls must be supplied by the production platform and verified independently.
