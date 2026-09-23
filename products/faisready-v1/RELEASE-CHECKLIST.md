# FAISReady v1 Release Checklist

## Product
- [x] RE1 preparation card
- [x] RE3 preparation card
- [x] RE4 preparation card
- [x] RE5 preparation card
- [x] RE5 R299 direct iKhokha checkout displayed
- [x] RE1 R399 and R549 bundle retained as gated follow-up routes until exact checkout links are recorded
- [x] mobile-first responsive layout
- [x] learner dashboard
- [x] mock quiz and score history
- [x] readiness guidance
- [x] learner launch-list lead form
- [x] employer/team enquiry form
- [x] institutional pilot option
- [x] local lead persistence
- [x] CSV lead export
- [x] only recorded RE5 checkout is exposed; unverified checkout routes remain gated
- [x] share action available
- [x] no FSCA endorsement or pass-guarantee claim

## Owner-laptop acceptance
- [ ] project installed under IZAKHONO WORK owner workspace
- [ ] local preview opens
- [ ] RE1/RE3/RE4/RE5 cards render
- [ ] mock quiz completes and saves score
- [ ] learner lead saves
- [ ] business lead saves
- [ ] CSV export downloads
- [ ] browser reload preserves local progress
- [ ] mobile viewport checked

## Before public production
- [ ] owner-controlled production persistence connected
- [ ] POPIA/privacy notices and retention process reviewed
- [ ] production domain and TLS configured
- [ ] monitoring/logging configured
- [ ] backups and restore tested
- [ ] merchant/payment evidence archived for every exposed production checkout
- [ ] RE5 payment-to-entitlement acceptance test complete
- [ ] ITN/webhook signature/amount/reference verification complete
- [ ] reconciliation tested against real settlement evidence
- [ ] refund/cancellation handling defined
- [ ] final regulatory/compliance copy review complete
- [ ] public-production smoke test completed

## Launch rule

Do not mark full public-commercial readiness complete from source code, owner-laptop proof or a visible Buy Button alone. RE5 checkout availability and payment-to-entitlement completion are separate gates.
