# I-CONNECT API Control Plane

The I-CONNECT API is the control plane for identity, tenants, services, voice, fleet and provisioning.

## Identity model
- One authenticated user can belong to multiple organisations.
- Each organisation owns service entitlements.
- Roles are scoped to the organisation.
- Every privileged mutation must be auditable.
- Production authentication is delegated to Supabase Auth; no passwords are stored by these functions.

## Roles
`owner`, `admin`, `manager`, `agent`, `dispatcher`, `finance`, `viewer`

## Service entitlements
`voice`, `contact_centre`, `mobile`, `connectivity`, `wifi`, `fleet`, `secure_fleet`, `provisioner`

## Production boundary
The API contract is deployable, but real customer identity and service state require the I-CONNECT Supabase project to be connected through environment variables. Carrier credentials, payment secrets and other provider secrets must never be committed to Git.

The database migration is `supabase/migrations/20261004_i_connect_identity_rbac.sql`.
