# IZAKHONO ENTITY BOUNDARY STANDARD

## Principle

**Separate businesses. Shared infrastructure. No accidental commingling.**

Every shared IZAKHONO platform service must treat `entity_id` as a first-class security and accounting boundary.

## Mandatory rules

1. Every commercial customer record belongs to one entity.
2. Every payment ledger row belongs to one entity.
3. Every subscription entitlement belongs to one entity.
4. Every authenticated session is scoped to one entity.
5. Every stored object/file/database row is entity-addressable.
6. Every API credential belongs to one entity or to the shared infrastructure operator.
7. Every audit/security event records entity context when applicable.
8. Cross-entity reads are denied by default.
9. Cross-entity transfers require an explicit service workflow and audit trail.
10. Shared services may operate centrally, but they must not merge legal, financial, customer or operational records.

## Downstream contract

Trusted internal requests should carry a verified identity context similar to:

```json
{
  "subject": "user@example.com",
  "entity_id": "ent_...",
  "entity_slug": "faisready-entity",
  "role": "member"
}
```

Services must never accept a caller-supplied `entity_id` as trusted unless it is derived from IZAKHONO ID or another authenticated internal service.

## Commercial separation

Technology sharing does not itself merge the entities. Intercompany licensing, service fees, cost allocation, data-processing roles and tax/accounting treatment must be documented separately by the relevant professional advisers.
