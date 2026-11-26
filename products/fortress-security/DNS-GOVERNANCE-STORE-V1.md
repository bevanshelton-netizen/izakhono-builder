# FORTRESS DNS Governance Store v1

## Durable records

The FORTRESS-owned PostgreSQL schema stores exact-scope DNS publication approvals and append-only publication authorization audit events. Approval rows are tenant-bound and include the DNS zone resource, normalized zone name, desired SOA serial, production environment, decision, approver, approval timestamp, expiry and revocation timestamp.

## Adapter boundary

`PostgresDnsGovernanceStore` implements the existing `DnsApprovalResolver` and `FortressAuditWriter` contracts. It performs parameterized approval reads and audit inserts. It deliberately does not expose approval creation or revocation; those writes belong to an authenticated FORTRESS approval workflow and must not be accepted from HOST or Runtime Fabric request payloads.

The audit table rejects UPDATE and DELETE through a database trigger. The authorization service still fails closed if the approval lookup fails or if audit persistence fails.

## Deployment boundary

The SQL migration is a repository artifact only. It has not been applied to any live database. The adapter requires an explicitly configured FORTRESS-owned PostgreSQL connection factory; it must not silently reuse HOST D1 or the Runtime Fabric deployment database. No public DNS publication or execution is performed by this component.
