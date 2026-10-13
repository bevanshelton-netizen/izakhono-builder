# ALLEGRO VIBEZ Production Acceptance

A release is only marked LIVE after every gate below has evidence.

- [ ] Public HTTPS endpoint reachable without repository/hosting login.
- [ ] Creator registration succeeds.
- [ ] Email verification/session flow succeeds.
- [ ] Creator profile persists and is publicly viewable.
- [ ] Audio/artwork upload succeeds to production object storage.
- [ ] Rights metadata is persisted and release cannot publish without confirmation.
- [ ] Moderation changes release from draft/submitted to approved.
- [ ] Approved release appears in public Discover catalogue.
- [ ] Checkout session is created through a configured payment adapter.
- [ ] A real or provider-approved test payment produces an authenticated webhook.
- [ ] Duplicate webhook delivery is idempotent.
- [ ] Transaction is recorded in minor currency units.
- [ ] Royalty ledger entry is created from the transaction.
- [ ] Wallet balance reflects the ledger, with no floating-point money math.
- [ ] Payout request is recorded and provider status is traceable.
- [ ] Creator onboarding/fulfilment is observable end-to-end.
- [ ] Backup/restore procedure is tested.
- [ ] Monitoring and error logs are available on IZAKHONO-owned infrastructure.
- [ ] Mobile and desktop visual QA passes.
- [ ] No LIVE claim is made before the evidence receipt is stored.
