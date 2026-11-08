# IZAKHONO NAV — Completion and Release Gates

## Product release position

The owned NAV engine, web client, Android wrapper and NODE01 deployment pipeline are in source control. They are not yet a verified public production release. No public-live claim is authorized until the acceptance gates below pass against the actual owned runtime.

## Capability matrix

| Capability | Current source position | Release acceptance still required |
|---|---|---|
| Road navigation | Valhalla adapter and route API implemented | Import South Africa graph; verify live routes and rerouting on real devices |
| Place search | Nominatim adapter and search API implemented | Complete South Africa import; verify address, POI and locality search |
| Map rendering | Martin tile service and owned PMTiles pipeline implemented | Build tile archive; verify live tile coverage and attribution |
| GPS | Browser GPS and native Android location bridge implemented | Field-test accuracy, permission handling, signal loss and recovery |
| Spoken navigation | Route-step speech and selectable voice-pack support implemented | Test supported device voices and supplied African-language packs |
| Conversational AI driver companion | Tap-to-talk prototype exists in the earlier application | Integrate into the canonical owned client and connect an owned/local inference provider |
| Safety Guardian | Device-local hazard reports and user-controlled location sharing implemented | Add verified shared hazard feeds, risk scoring and field validation |
| SOS / emergency response | SOS opens the device share sheet with the driver's location | Integrate approved emergency contacts/dispatch partners; do not describe share-sheet behavior as dispatch |
| Hijacking response | Not operational | Build and test discreet alert, trusted-contact escalation and FORTRESS handoff |
| Offline maps | Explicit same-origin route-tile caching and saved-route support implemented in source | Test service-worker control, tile downloads, offline reload and storage limits on Android and web |
| Offline routing | Saved journey can be restored; no new route calculation is promised offline | Add/test an offline routing graph and route recalculation if full offline navigation is required |
| Live traffic | No verified live traffic provider connected | Integrate an approved traffic data source or explicitly label traffic as unavailable |
| Sports audio | Not integrated into canonical client | Connect licensed/live score feed, audio controls and safe-driving interaction |
| Vehicle intelligence | Native device and journey foundations only | Integrate supported OBD-II/OEM telemetry and maintenance events |
| Fleet / CIT | Architecture direction only | Add authenticated fleet backend, device enrolment, dispatcher console, event escalation and audit trail |
| African road intelligence | South Africa dataset pipeline implemented | Complete South Africa first, then add and validate additional African country datasets |

## Owned production release gates

1. **CI verification:** engine unit tests, owned-stack integration tests, Android APK build, shell syntax, Compose validation, backup verifier tests and production verifier syntax must pass on the current release commit.
2. **Runtime access:** the self-hosted GitHub runner labelled `node01` must be online and able to execute the approved deployment workflow. NODE01 is an IZAKHONO software runtime target; proprietary physical navigation hardware is not required.
3. **Capacity:** pass the owned-stack preflight. Current guidance is at least 8 GB RAM and 30 GB free disk, with 16 GB RAM and 60 GB free disk recommended for South Africa imports and tile generation.
4. **Data activation:** verify the South Africa OSM extract, Nominatim database, Valhalla graph and PMTiles archive are present and healthy.
5. **Network and DNS:** confirm public ingress on ports 80/443 and point `nav.izakhono.africa` to the owned edge. The domain is currently verified/assigned in the Vercel project; DNS cutover and rollback must be controlled and evidenced.
6. **TLS:** verify Caddy certificate issuance, HTTPS, HSTS and renewal behavior on the owned edge.
7. **Public API acceptance:** verify `/api/health`, `/v1/runtime`, `/api/search`, `/api/route` and `/tiles` using real requests.
8. **Device acceptance:** test current Android devices, GPS permissions, speech, voice guidance, screen-awake behavior, offline tile retrieval, app resume and signal-loss recovery.
9. **Safety acceptance:** confirm local hazard reports are clearly identified as local-only; verify location sharing; do not claim emergency dispatch or hijack response until real integrations are tested.
10. **Recovery acceptance:** create a real backup, verify its checksums, replicate off-node and complete a controlled isolated full-stack restore before claiming disaster recovery readiness.

## Current blockers and evidence

- Current source has been updated on `main`; the latest CI result has not been retrieved/verified in this session.
- Vercel deployment API requests are currently rate-limited. The latest attempted deployment failed earlier at build time because the deployment commit had an empty root `package.json`; the production alias still references an older READY deployment.
- The owned NODE01 promotion workflow requires an online self-hosted runner labelled `node01`. Runner availability has not been verified here.
- The owned South Africa imports, public DNS cutover, TLS issuance, public endpoint tests, Android device tests and backup/restore execution have not been evidenced here.
- The Cloudflare production environment previously reported missing API credentials for its optional external-resilience deployment. External resilience is not required for the owned-first launch and remains disabled by default.

## Release rule

A Git commit, successful build, ready deployment object, or attractive user interface is not proof of a live navigation service. Mark NAV production-ready only when the owned runtime, public DNS/TLS, route/search/tile APIs, device behavior, safety boundaries and recovery evidence have all passed.
