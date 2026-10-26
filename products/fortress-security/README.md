# IZAKHONO FORTRESS SECURITY™

Authorized defensive vulnerability discovery, remediation planning, retesting and evidence platform.

## Purpose

FORTRESS SECURITY is the defensive scanning layer of the IZAKHONO security fabric. It is designed to inspect explicitly authorized assets, identify exposed services and high-confidence configuration weaknesses, produce explainable findings, and verify remediation after changes.

**Flow:** `AUTHORIZE → DISCOVER → ASSESS → PRIORITIZE → REMEDIATE → RESCAN → VERIFY → EVIDENCE`

## Safety boundary

- Scans require `FORTRESS_AUTHORIZED_SCAN=1`.
- Every target must be explicitly listed in the scan scope.
- No credential guessing, password spraying, exploit execution, destructive testing, persistence, malware, or unauthorized target discovery.
- The first implementation uses safe TCP connection checks and HTTP/TLS inspection only.
- Findings are evidence-backed signals and are not proof of compromise.

## v1 checks

- HTTP security headers
- HTTP TRACE exposure
- exposed `phpinfo.php`
- exposed `.env` path detection (without retrieving secrets)
- TLS certificate expiry/hostname validation
- common management/database service exposure by explicit port list
- service exposure severity and remediation guidance
- signed-style deterministic JSON evidence records via SHA-256 digest

## Example scope

```json
{
  "owner": "IZAKHONO",
  "assets": [
    {
      "id": "fortress-self",
      "host": "127.0.0.1",
      "ports": [80, 443, 5432, 3306, 22]
    }
  ]
}
```

The scanner does not automatically authenticate to services. A database port being reachable is reported as exposure requiring review, not as a successful login.

## Next integration layers

1. Asset inventory and approved CIDR scope service
2. FORTRESS Control Plane integration
3. recurring scan scheduler
4. evidence storage and tenant isolation
5. low-risk remediation adapters with explicit approval
6. CI/security-gate integration
7. owned-first IZAKHONO node execution and failover

Production status is evidence-gated; this repository addition does not claim public deployment or production security certification.
