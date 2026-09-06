# FAISReady Payment Integration Gate

FAISReady v1 deliberately ships with payment processing disabled.

## R399 offer

The page may advertise the intended R399 launch package and collect expressions of interest. It must not present a functional checkout or claim that payments are live until the conditions below are met.

## Activation requirements

1. Merchant account is verified for the correct legal entity.
2. Production merchant credentials are stored outside source code.
3. Checkout amount and product reference are generated server-side.
4. Payment notification / ITN / webhook source and authenticity are verified.
5. The amount, currency and merchant reference are verified before granting entitlement.
6. Duplicate notifications are idempotent.
7. Failed, cancelled and pending states do not grant paid access.
8. Settlement/reconciliation is matched against independently retrieved payment evidence.
9. Refund and reversal states remove or adjust entitlement correctly.
10. Audit records include the order, notification, verification result and reconciliation state.
11. End-to-end production payment testing has been completed.
12. Only after the above passes may the "Join the R399 Launch List" CTA be changed to an active payment CTA.

## Current state

PAYMENTS_ACTIVE=false

The product is safe to use for lead generation and local preparation demonstrations without collecting money.
