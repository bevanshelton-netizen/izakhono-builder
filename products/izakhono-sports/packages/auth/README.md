# Authentication Boundary

Authentication is deliberately provider-neutral so the Sports OS remains portable across IZAKHONO-owned infrastructure.

Roles:
- PLATFORM_ADMIN
- ORG_OWNER
- ORG_ADMIN
- COACH
- ATHLETE
- OFFICIAL
- SPONSOR
- SCOUT
- FAN

Authorization must be organisation-scoped and deny-by-default. Production identity, MFA, password recovery, session storage and audit logging must be configured before public launch.
