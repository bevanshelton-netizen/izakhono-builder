# NODE01 v0.9 — Tool Fabric

NODE01 now has a narrow execution boundary for allowlisted tools.

## Rules

1. Tools must be explicitly registered.
2. The requested risk must match the registered risk.
3. Every request is evaluated by the existing fail-closed policy.
4. Destructive actions are blocked without an explicit owner-approval mechanism.
5. External side effects return `approval_required` until approval is explicitly supplied.
6. Every result receives a deterministic SHA-256 evidence hash.
7. Tool handlers execute only inside this boundary; model output never directly invokes arbitrary code.

## Production boundary

The fabric itself does not make a provider, network, credential, browser, payment, DNS, email, or other external integration live. Those capabilities require separately registered, authorized adapters and independent infrastructure evidence.
