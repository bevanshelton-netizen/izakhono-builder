# CONNECT Push Plane

The CONNECT push plane is designed to keep notifications under the IZAKHONO-owned-first architecture while allowing reversible FCM/APNs/Web Push adapters.

## Database

`connect_devices` is the device registry. `connect_register_device()` and `connect_unregister_device()` are authenticated SECURITY DEFINER RPCs. Device tokens are indexed by SHA-256 hash and associated with the authenticated user and platform.

## Web Push

The service worker now handles standard Web Push payloads and notification clicks. Browser registration is intentionally gated on a provisioned VAPID public key; no private key belongs in the browser.

## Activation gate

Push is **not represented as active** until:

1. An IZAKHONO-controlled push sender is provisioned.
2. Web Push VAPID credentials are generated and stored server-side, or FCM/APNs credentials are provisioned for native clients.
3. A server-side sender can target `connect_devices` without exposing credentials to clients.
4. Delivery is tested on supported Android, iOS and web clients.
5. Invalid/expired tokens are removed or disabled safely.

External push providers remain adapters, not the CONNECT application architecture.
