# IZAKHONO CONNECT

Cross-platform communication foundation for Android, iPhone/iPad, web/PWA and future desktop clients.

## Current foundation

- Supabase authentication and profile bootstrap
- Direct and group-ready conversation model
- Realtime messaging
- Offline outbox and reconnect flush
- Delivery/read receipts
- Browser voice/video calling via WebRTC
- Realtime call signaling
- PWA manifest, icon and service worker
- Row-level security for conversations, members, messages, profiles, presence, receipts and calls

## Security boundary

The browser uses the Supabase publishable key only. Authorization is enforced by Postgres RLS and authenticated RPCs. Private-message end-to-end encryption is not claimed until an audited protocol/library is integrated and verified.

## Production hardening still required before claiming full telecom-grade readiness

- TURN infrastructure for restrictive NATs
- Push notification credentials and delivery verification
- Media upload/storage policy and attachment UX
- Native Android/iOS signing and store release credentials
- Automated integration tests across real devices/networks

The architecture is deliberately provider-reversible so these dependencies can be replaced by IZAKHONO-owned infrastructure as it matures.
