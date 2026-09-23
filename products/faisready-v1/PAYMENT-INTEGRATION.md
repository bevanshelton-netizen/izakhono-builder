# FAISReady Payment Integration Gate

FAISReady v1 exposes only payment routes whose exact production checkout destination has been captured and approved. The recorded RE5 Complete Preparation iKhokha Buy Button may be linked directly; all other checkout routes remain gated until their exact production links and commercial controls are verified.

## Current offers

- RE5 Complete Preparation — R299 — direct recorded iKhokha Buy Button route.
- RE1 Complete Preparation — R399 — payment link not recorded in this repository; follow-up route only.
- RE1 + RE5 Bundle — R549 — exact production checkout link is not recorded in this repository; follow-up route only.
- RE3 / RE4 — preparation pathways; no checkout is exposed until the commercial route is approved.

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
12. Only a payment route with an exact approved production destination may appear as a direct checkout CTA. Automated entitlement must not be granted until webhook, amount/reference and reconciliation controls pass.

## Current state

RE5_DIRECT_CHECKOUT_LINKED=true
AUTOMATED_ENTITLEMENT=false
OTHER_CHECKOUTS_ACTIVE=false

The RE5 button is a direct handoff to the recorded iKhokha Buy Button. FAISReady does not yet claim automatic post-payment entitlement or reconciliation. RE1, RE3, RE4 and bundle routes remain follow-up/gated until their exact production checkout destinations are captured and verified.
