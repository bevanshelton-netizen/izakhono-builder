# APP FABRIC hybrid client

This client is the portfolio browser-side pattern for low-risk commercial lead events.

Routing order:

1. owned APP FABRIC at `https://fabric.izakhonoafrica.co.za`;
2. verified external resilience bridge;
3. return an explicit unavailable result if both routes fail.

The external bridge persists the lead/opportunity mirror before attempting hand-back to the owned route.

## Boundary

This helper is for `lead.created` only. It must not be used to assert payment completion, entitlement, regulated approval, identity verification, child/learner protected records, bank credentials, transaction secrets, PINs or authentication material.

Each product still owns its operational source of truth. APP FABRIC is the commercial relationship layer.
