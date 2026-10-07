# Provisioning Contract

A customer-facing order should eventually resolve to this contract:

```json
{
  "product": "media-channel",
  "channel_name": "Example TV",
  "plan": "starter",
  "payment_status": "paid",
  "domain": "example.tv",
  "approval_required": true
}
```

Provisioner responsibilities:

1. Verify payment.
2. Create the channel.
3. Allocate storage and media path.
4. Return admin and ingest credentials through the secure delivery mechanism.
5. Configure DNS/TLS on IZAKHONO-owned infrastructure.
6. Run a stream health check.
7. Only after explicit approval, transition the channel to published.
