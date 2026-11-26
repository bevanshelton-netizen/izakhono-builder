# NODE01 Signed Release Approval v1

## Purpose

A deployment profile's `approved_ref` is configuration, not proof of owner approval. The gateway must ultimately verify a signed, narrowly scoped approval statement before forwarding a deployment request to CONTROL.

## Statement

Version 1 signs a canonical JSON object containing:

- `version`: integer 1;
- `approvalId`: unique approval identifier;
- `repository`: exact owner/repository identity;
- `commitSha`: exact lowercase 40-character Git commit SHA;
- `workload`: exact deployment profile/workload;
- `environment`: exact target environment;
- `action`: permitted action, initially `deploy`;
- `approvedBy`: accountable approving principal;
- `keyId`: identifier of the signing key;
- `issuedAt` and `expiresAt`: ISO-8601 timestamps.

The signature is Ed25519 over canonical JSON with recursively sorted object keys, encoded as unpadded base64url. Implementations must use the same canonicalization rules.

## Verification contract

The reference verifier checks statement shape, version, SHA format, timestamp validity, maximum validity window, key existence and lifecycle, optional principal binding, exact repository/commit/workload/environment/action scope, signature encoding and Ed25519 signature.

The caller supplies the keyring and expected deployment scope. The module intentionally embeds no production public keys and has no authority to enrol or revoke keys.

## Remaining integration requirements

- Load trust roots from an owner-controlled FORTRESS/secret-management trust path.
- Define key custody, key enrolment, rotation and revocation ownership.
- Persist and enforce one-time approval IDs / replay policy in an approved authoritative store.
- Bind the verifier to NODE01 gateway request handling before CONTROL forwarding.
- Add audit records identifying approval ID, principal, key ID, scope and verification result.
- Establish a revocation freshness policy and trusted clock source.
- Ensure test keys are ephemeral and cannot be accepted in production.

## Safety boundary

This reference verifier and its ephemeral-key tests are not production trust configuration. No production key, approval, secret, runner, host, database, DNS or deployment is created or changed by this specification.
