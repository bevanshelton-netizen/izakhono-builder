# IZAKHONO NAV

**Product:** IZAKHONO NAV  
**Operator:** IZAKHONO AFRICA (PTY) LTD  
**Current package:** v0.7  
**Status:** BUILT / VERIFIED LOCALLY  
**Runtime policy:** IZAKHONO Runtime Fabric — no single node is a launch gate

## Product boundary

IZAKHONO NAV is the portfolio's privacy-first multilingual voice navigation platform.

The application is packaged to run unchanged across approved Runtime Fabric targets. NODE01 is not required. Any healthy approved runtime may serve the same release, and EDGE may fail over between targets after health and release identity checks.

## v0.7 runtime behavior

- configurable runtime targets outside application logic;
- health probing of all enabled NAV gateways;
- highest-priority healthy target selection;
- forced re-probe and retry after an owned runtime request fails;
- runtime ID, runtime class and release ID in gateway health;
- visible serving-runtime state in the NAV UI;
- same immutable application build across owned and external resilience targets.

## Release evidence

Package SHA-256:

`6d458b36cd1fc93753152674739d98aacc21dd652f1fc65f79b6108611d7c0b0`

The package passed JavaScript syntax, Runtime Fabric selection tests, gateway unit tests, Python compile, shell syntax, JSON/YAML parse, Android asset sync, local asset integrity and local HTTP 200 checks.

## Public status

No public-live claim is made by this record. A route becomes EXTERNAL LIVE VERIFIED, OWNED LIVE VERIFIED or FABRIC LIVE VERIFIED only after current public HTTPS and health evidence passes the portfolio directive.

## Next production gate

1. Place the same v0.7 release on at least one reachable Runtime Fabric target.
2. Configure real routing/search/tile services or an approved resilience route.
3. Verify public HTTPS.
4. Add a second independent target.
5. Stop the preferred target during a controlled test and verify uninterrupted failover.
