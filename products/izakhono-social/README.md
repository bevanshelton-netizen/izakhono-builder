# IZAKHONO SOCIAL

A privacy-first, safety-led social network product built for IZAKHONO AFRICA.

## Product promise

- people, not profiling
- no behavioural tracking, advertising IDs or silent analytics
- user-controlled feed modes
- profiles, connections, communities, messages, pages, events, video and marketplace foundations
- visible Safety Centre and Community Standards
- strong protections against sexual exploitation of minors
- no pornography
- no illegal drug dealing or promotion
- no gang recruitment or violent criminal glorification
- legitimate journalism, education, prevention, recovery, research and history handled contextually rather than by crude blanket censorship

## Current implementation

This first product slice is an interactive Next.js 16 application with:
- responsive social feed
- post composer
- baseline server-side text moderation
- block/review/allow outcomes
- safety and standards pages
- health endpoint
- standalone Docker production build
- IZAKHONO manifest for NODE01 owned-first deployment

The baseline filter is deliberately only the first safety layer. Production requires image/video moderation, hash matching for known illegal material, account risk signals, rate limits, human review, appeals, trusted flaggers, evidence preservation rules and jurisdiction-specific escalation procedures.

## Infrastructure

Primary target: IZAKHONO-owned NODE01.

External hosting may be used as a reversible launch/failover route. External infrastructure must never become the sole source of truth.

## Run locally

```bash
npm install
npm run dev
```

Health check:

```text
GET /health
```

## Next engineering gates

1. Add production identity/authentication and account recovery.
2. Add durable social graph, posts, comments, reactions, groups and message storage.
3. Add encrypted transport and stricter private-message authorization.
4. Add media upload pipeline plus image/video moderation.
5. Add report queue, human moderation console and appeals.
6. Add minor-safety defaults and guardian/age-assurance strategy.
7. Add owned database/object-storage adapters with reversible external fallback.
8. Add abuse prevention, spam controls, rate limiting and device/session security.
9. Verify NODE01 build and public HTTPS route before calling the product live.
