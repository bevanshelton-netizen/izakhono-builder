# Runtime Fabric provider adapters

Adapters translate Runtime Fabric operations into provider-specific API calls.

## Contabo

`contabo_compute.py` provides the minimal compute API boundary needed to authenticate and request a VPS. Credentials are read only from environment variables and are never returned by the summary helper.

The adapter intentionally does **not**:

- mark a node production-ready;
- configure customer DNS/TLS;
- decide routing authority;
- store customer data as the source of truth;
- manufacture acceptance evidence.

A successful Contabo API response means only that the provider accepted the requested compute operation. Runtime Fabric health, release verification, EDGE/TLS/DNS certification and LIVE status remain separate gates.

Offline tests are in `test_contabo_compute.py` and require no credentials or network access.
