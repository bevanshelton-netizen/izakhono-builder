# IZAKHONO SOCIAL API adapter

Current external-resilience adapter: `connecta-external` v8.

All legacy CONNECTA actions remain available. IZAKHONO SOCIAL adds these authenticated actions:

- `social-me`
- `social-feed?mode=for-you|following`
- `social-post`
- `social-like-toggle`
- `social-bookmark-toggle`
- `social-bookmarks`
- `social-repost-toggle`
- `social-follow-toggle`
- `social-profile`
- `social-profile-update`
- `social-search`
- `social-conversations`
- `social-conversation-create`
- `social-messages`
- `social-message-send`

Registration and login intentionally reuse the legacy `register` and `login` actions so CONNECTA and IZAKHONO SOCIAL share one identity graph.

## Security model

The Edge Function holds the database service credential server-side. Browsers authenticate with opaque session tokens. The `connecta_*` tables use RLS and are not made directly writable to browser roles.

The external Edge Function is a resilience adapter. The owned production target remains IZAKHONO Runtime Fabric behind FORTRESS / EDGE / TLS / IZAKHONO DNS.
