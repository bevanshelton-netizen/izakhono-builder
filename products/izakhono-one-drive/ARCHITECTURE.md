# ONE DRIVE — architecture and trust boundaries

Client → CORE/FORTRESS identity → ONE DRIVE API → authorization/policy → transactional quota ledger → object-store adapter → IZAKHONO DATA / configured S3-compatible storage.

Audit every authorization-sensitive action. Object bytes never pass through a public bucket. Presigned URLs are short-lived and scoped to one object and operation, issued only after authorization.

## Isolation
- Personal space: owner user ID, kind personal, one owner.
- Business space: organization/tenant ID, kind business, explicit membership and role.
- Every row carries space_id; queries are constrained by principal and authorized membership.
- RLS is defense in depth, not a substitute for API authorization.
- Object keys are opaque random identifiers; filenames are metadata.
- Cross-space moves are copy-and-authorize operations, never key renames.

## Quota correctness
Reserve bytes transactionally under a row lock. Reservation has expiry and idempotency key. Completion converts reserved to used only after object store confirms size and checksum. Expired/failed uploads release reservations. Counter updates must be transactional.

## Security defaults
Sharing disabled; no anonymous access; least-privilege roles owner/admin/editor/viewer; soft delete and retention; malware scan gates downloads; append-only audit; runtime-injected secrets; export/restore supports provider replacement.

## Adapter contract
Implement create-upload-intent, inspect-object, create-download-intent, delete-object and health-check. Adapter-specific identifiers must not leak into product APIs. Portability requires export/restore tests.

## Unresolved deployment inputs
Physical capacity, active node bindings, storage class health, backup target, CORE/FORTRESS endpoints and object-store credentials are deployment-time verified inputs. Never infer or invent them.
