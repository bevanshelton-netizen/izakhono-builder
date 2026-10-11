# IZAKHONO Edge Routing

The edge is software, not a dedicated load-balancer appliance.

## Route source

The control plane owns the desired route table. Each route contains:

- host
- application
- active node
- active port
- active revision
- previous healthy revision when available

## Routing rules

- Only `production` revisions are eligible for public traffic.
- Failed or unverified revisions are never selected.
- If a node heartbeat expires, its routes become unavailable and the scheduler must select another healthy revision/node.
- If no healthy route exists, return `503 Service Unavailable` rather than guessing.
- Promotion and rollback update the route atomically.

## TLS

TLS is a software edge responsibility. ACME certificates should be issued and renewed automatically by the edge layer. Certificate state belongs to the runtime, not an external hosting platform.

## Scaling

Scaling is software scheduling across commodity nodes. NODE01 is the first capacity unit; NODE02+ are interchangeable capacity units. No application may depend on a specific physical machine name.
