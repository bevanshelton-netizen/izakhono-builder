# IZAKHONO REGISTRY™

Machine-readable inventory for the IZAKHONO estate.

Registry records describe platforms, nodes, domains, deployment refs and readiness without becoming the deployment authority.

Rules:
- CONTROL remains deployment authority.
- NODE remains execution authority.
- Registry is metadata/state only.
- Secrets are never stored here.
- Production records require immutable commit SHA.
- Public-live status requires external evidence.

The initial format is deliberately file-based so it can operate on NODE01 without a database dependency. It can later be backed by IZAKHONO DATA without changing the record contract.
