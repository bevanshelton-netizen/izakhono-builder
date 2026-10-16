# Provisioner Security Baseline

- Service-role database credentials are server-only.
- Browser clients use publishable credentials and authenticated sessions only.
- Provider API credentials are never stored in frontend code.
- Production API endpoints require service authentication before public exposure.
- TLS terminates only on trusted infrastructure.
- Provisioning actions are idempotent and auditable.
- Failed provider actions stop the affected workflow rather than being represented as successful.
- Logs must avoid passwords, tokens, payment secrets and unnecessary personal information.
- Provider adapters are independently disableable.
