# IZAKHONO IDENTITY™ — V1

## Purpose

Provide the identity authority for the private IZAKHONO namespace and establish the canonical first identity:

`bevan@izakhono`

## Identity model

An identity consists of:

- canonical address
- namespace
- mailbox binding
- authentication credential reference
- status
- audit metadata

The identity authority owns identity semantics. Mail transport, webmail and DNS consume identity records; they do not redefine them.

## Canonical identity

```text
Display name: Bevan Shelton
Address: bevan@izakhono
Namespace: izakhono
Status: owner
Mailbox: bevan@izakhono
```

## Rules

1. Only the IZAKHONO namespace is accepted by the private identity authority.
2. Addresses are normalized to lowercase for lookup while preserving display metadata separately.
3. Identity creation is idempotent by canonical address.
4. Passwords are never stored in plaintext.
5. Authentication sessions use revocable opaque tokens whose stored representation is hashed.
6. Identity operations are auditable.
7. Identity authority does not claim public Internet identity or public-domain ownership.

## Mail binding

The identity authority provisions a mailbox binding for every active mail identity. The first mailbox is `bevan@izakhono`.

Local mail delivery must resolve the recipient through the identity authority before accepting a message as delivered.

## API contract

```text
createIdentity(address, profile)
getIdentity(address)
ensureIdentity(address)
setIdentityStatus(address, status)
validateIdentity(address)
```

## Security boundary

Owner bootstrap must be one-time and must not expose a reusable public bootstrap endpoint. Production activation requires a locally controlled bootstrap secret or equivalent secure enrollment mechanism.

## Runtime acceptance

Identity is runtime-ready only when an actual IZAKHONO node demonstrates:

- `bevan@izakhono` exists in the identity store.
- Login succeeds with the owner-created credential.
- A valid session can access only the authenticated identity.
- Logout/revocation invalidates the session.
- The mailbox is bound to the identity.
- Identity state survives service restart.
- Audit records are produced for authentication and identity changes.
