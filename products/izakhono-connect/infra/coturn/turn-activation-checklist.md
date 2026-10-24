# IZAKHONO CONNECT — Owned TURN Activation Checklist

## Activation gate
TURN is **not active** until every item below is verified on an owned/reversible node.

- [ ] TURN hostname resolves to the owned node.
- [ ] UDP 3478 reachable.
- [ ] TCP 3478 reachable.
- [ ] TLS 5349 reachable with a valid certificate.
- [ ] Relay port range 49152-65535 reachable as configured.
- [ ] Server-side short-lived TURN REST credentials are generated.
- [ ] Browser/client receives only temporary TURN credentials; no long-lived secret is shipped to the client.
- [ ] `connect_call_turn_config` returns an active configuration only after the node and credentials are verified.
- [ ] Voice and video calls succeed behind restrictive NAT using TURN relay.
- [ ] Relay capacity, failures and latency are observable.
- [ ] Recovery/failover path is documented and tested.

## Security rules

Never commit TURN shared secrets, private keys, passwords, or service-account credentials to GitHub. Keep management access restricted and rotate credentials.

## Release rule

Until the activation gate is complete, CONNECT remains STUN-first with TURN capability held behind the backend activation gate. Do not describe TURN as live or production-active.
