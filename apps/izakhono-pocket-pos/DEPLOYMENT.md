# PocketPOS owned-engine deployment

1. From `apps/izakhono-pocket-pos`, create the isolated D1 database: `npx wrangler d1 create izakhono-pocket-pos`.
2. Put the returned UUID into `wrangler.jsonc` as `database_id`.
3. Set secrets with Wrangler: `BOOTSTRAP_SECRET`, `IK_APP_ID`, `IK_APP_SECRET`, and `PUBLIC_BASE_URL`.
4. Apply the migration: `npm run migrate`.
5. Deploy: `npm run deploy`.
6. Verify `GET /api/health` over HTTPS.
7. Bootstrap exactly once with `POST /api/admin/bootstrap` and the `x-bootstrap-secret` header.
8. Test login, cash sale, stock decrement, duplicate Idempotency-Key handling, iK Pay link creation, signed callback verification and dashboard totals.
9. Call the platform **live** only after independent HTTPS acceptance and a real low-value payment/reconciliation test.

iK Pay request signing follows iKhokha's developer contract: HMAC-SHA256 of the request path plus JSON body, using the application secret, with `IK-APPID` and `IK-SIGN` headers. Secrets are never exposed to the browser.
