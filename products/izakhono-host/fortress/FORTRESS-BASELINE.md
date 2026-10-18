# FORTRESS — IZAKHONO Host Security Baseline

FORTRESS is the security boundary around the owned host rather than a feature bolted on after deployment.

## Mandatory controls

1. Secrets are supplied through environment/secret stores and never committed to Git.
2. Control-plane API calls require bearer authentication.
3. Public services expose only the ports required for DNS, HTTP and HTTPS.
4. Runtime site paths are constrained to the provisioned site's directory.
5. Production acceptance requires independent DNS, HTTPS and content verification.
6. Backups must be integrity-checked and restoration must be tested before a production release.
7. Administrative access is separated from public site traffic.
8. Logs and audit events must be retained on owned storage where possible.
9. External providers are adapters/fallbacks, not architectural dependencies.
10. Any security exception must be explicit, documented and reversible.

## Release rule

No node, site or service is declared production-live merely because a container starts. FORTRESS acceptance requires the service to pass its functional, network and recovery gates.
