# I-CONNECT API Control Plane

The I-CONNECT API is the control plane for identity, tenants, contact-centre operations, service provisioning, billing, usage and carrier-neutral voice orchestration.

## Identity and tenancy
- One authenticated user can belong to multiple organisations.
- Each organisation owns service entitlements.
- Roles are scoped to the organisation.
- Every privileged mutation must be auditable.
- Production authentication is delegated to Supabase Auth; no passwords are stored by these functions.

## Roles
`owner`, `admin`, `manager`, `agent`, `dispatcher`, `finance`, `viewer`

## Service entitlements
`voice`, `contact_centre`, `mobile`, `connectivity`, `wifi`, `fleet`, `secure_fleet`, `provisioner`

## Contact-centre model
- Queues
- Agents
- Registered mobile bridge mode
- Softphone mode
- Masked customer numbers
- Call state and CDR foundation
- Dispositions and billable seconds

## Provisioning model
Provisioning jobs are idempotent and move through:
`pending -> approved -> running -> waiting_provider -> completed|failed|cancelled`.

Provider credentials remain server-side and are never stored in source control.

## Billing model
- ZAR-ready invoices stored in integer cents.
- Usage records support service, quantity, unit pricing and rated amount.
- Voice CDRs can feed usage rating once an authorised carrier adapter is connected.

## Security
The second migration moves privileged membership checks out of the exposed `public` schema into `ic_private`, revokes PUBLIC execution, scopes execution to authenticated users and keeps RLS on every exposed application table.

## Production boundary
The API contracts and schema are deployable, but real customer identity and persistent telecom state require a **dedicated I-CONNECT Supabase project** to be connected through environment variables.

Real PSTN calls also require an authorised carrier/SIP adapter, compliant numbering and credentials. The application must not represent those services as live until independently verified.

Migrations:
- `supabase/migrations/20261004_i_connect_identity_rbac.sql`
- `supabase/migrations/20261005_i_connect_control_plane.sql`
