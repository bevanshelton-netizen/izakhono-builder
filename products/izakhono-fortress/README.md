# IZAKHONO FORTRESS

FORTRESS is the sovereign security boundary for the IZAKHONO group stack.

## Operating rule

**Inside IZAKHONO:** owner-controlled services are the default.

**Outside IZAKHONO:** external providers, including OpenAI, may be used deliberately for advisory, research, public-content generation, sanitized debugging and similar non-core work.

External providers must never become the authority for identity, entitlements, payments, ledgers, secrets, customer systems of record or core runtime availability.

## External AI rule

External AI is an optional external capability, never a required core runtime dependency. The current allowed data classes are public, non-sensitive and intentionally sanitized internal information.

FORTRESS denies credentials, passwords, private keys, raw authentication tokens, payment-card data, banking credentials, sensitive personal/customer data, database dumps and private source secrets. Unknown providers, purposes and data classes are denied.

## Entity boundary

Every outbound authorization request must carry a non-empty `entity_id`. This is a required request-scope marker; it is **not** an identity proof or an authoritative entity-ownership check. The current guard does not yet prove that the caller owns or is a member of the named entity. Do not treat this narrow control as complete multi-tenant isolation.

## Policy decision service

`guard.py` provides:

- `GET /healthz`
- `GET /v1/policy` (bearer token required)
- `POST /v1/authorize-egress` (bearer token required)

The service is a narrow policy decision point, not a transparent network firewall. Products must route declared external egress through this decision; this service alone cannot guarantee operating-system-level blocking or prevent unmediated network paths.

### Hardening in this revision

- Strict policy structure checks and default-deny validation.
- Non-object requests and non-string scope fields are denied.
- Forbidden data classes take precedence over any accidental allowlist overlap.
- Iterative nested-field scanning avoids recursion-depth failures.
- HTTP requests require one valid Content-Length and application/json.
- Transfer-Encoding ambiguity, incomplete bodies, malformed JSON and non-object JSON are rejected.
- Bodies larger than 256 KiB are rejected with HTTP 413; they are not truncated and parsed.
- Policy load/validation failures return a controlled 503 and make health checks fail.
- The service refuses non-IPv4-loopback bind addresses at startup.
- Ordinary request logging does not emit request paths, headers or bodies.

The exact forbidden-field scan is a useful guardrail, not a general-purpose secret detector. It does not prove that secrets embedded in arbitrary prose, images, encoded blobs or attachments are detected.

## Local validation

From the repository root:

```bash
python -m unittest discover -s products/izakhono-fortress/tests -v
```

Tests use synthetic fixtures and a synthetic bearer token. Never put real credentials in tests or source control.

## OpenAI relationship

The policy is intentionally not "never use OpenAI." IZAKHONO remains sovereign and protected. External AI may be used outside the sovereign core when it is useful, deliberate, appropriately sanitised and never required for IZAKHONO to keep operating.
