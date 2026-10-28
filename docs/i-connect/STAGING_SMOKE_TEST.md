# I-CONNECT Staging Smoke Test

## Objective
Verify the isolated I-CONNECT staging application boundary without representing it as a live telecom service.

## Sequence
1. Load the I-CONNECT customer interface.
2. Confirm the staging environment marker is visible.
3. Confirm plan/product selection can be opened.
4. Create a test customer using non-production data.
5. Create a test order.
6. Send a simulated idempotent payment event.
7. Verify the order transitions to `READY_TO_PROVISION`.
8. Trigger a simulated provisioning job.
9. Verify the order transitions to `PROVISIONING`.
10. Confirm the operations view exposes the transaction and status.
11. Confirm no production carrier, RICA, payment, or customer credentials are present.

## Release boundary
A successful staging smoke test does not mean I-CONNECT is commercially live. Production release still requires verified host-network onboarding, regulatory/RICA requirements, production payment credentials, security controls, operational readiness, and deployment verification.
