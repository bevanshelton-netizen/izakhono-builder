# CONNECTA Hybrid Deployment Contract

CONNECTA follows the portfolio rule: **owned first, externally reversible**.

## Primary owned route

`IZAKHONO CODE -> NODE01 -> PostgreSQL + CONNECTA ENGINE + CONNECTA Web -> EDGE/TLS -> IZAKHONO DNS`

The NODE01 package is `docker-compose.owned.yml`. The full-stack health gate is `GET /health` on the web service; that route returns HTTP 200 only when the web layer can also reach a healthy CONNECTA ENGINE and PostgreSQL database.

Run the owner-machine launcher:

`products/izakhono-social/RUN-CONNECTA-NODE01.cmd`

It performs local owned proof only. It does not change DNS.

## External resilience route

The Next.js web application can run on an approved external host without rebuilding the product. Configure the server-only variable:

`CONNECTA_ENGINE_URL=https://<approved-connecta-engine-host>`

The browser never receives the engine session token; the Next.js server stores it in an HTTP-only cookie and proxies authenticated requests.

A web-only external route is **not sufficient resilience** if it points to an unverified or single NODE01 engine. Before calling the external route live, the configured engine endpoint must itself have a tested data, media, backup and failover plan.

## Privacy

Do not enable Vercel Web Analytics, Speed Insights, advertising IDs, third-party behavioural analytics or cross-site profiling. Necessary infrastructure logs remain operational/security data only.

## Live gates

Do not use LIVE/LAUNCHED/DEPLOYED language until the relevant route independently proves:
1. HTTPS 200 on `/health`;
2. `engine: "ok"` in the health response;
3. registration/login through the secure proxy;
4. real feed/community/post persistence;
5. backup + restore evidence;
6. rollback/failback evidence;
7. DNS/TLS correctness for the named public hostname.

Until those gates pass, status is **BUILT / VERIFIED LOCALLY** or **NOT YET PUBLIC**.
