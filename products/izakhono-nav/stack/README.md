# IZAKHONO NAV — Owned Stack v1

This is NAV's complete owner-controlled runtime stack. It does not require NODE01, Vercel or Cloudflare.

## Services

- **nav-engine** — IZAKHONO NAV ENGINE.
- **nav-router** — Valhalla routing built from the South Africa OpenStreetMap extract.
- **nav-search** — Nominatim 5.3 address/POI search with Geofabrik replication updates.
- **nav-tiles** — Martin serving and raster-rendering locally generated PMTiles.
- **nav-edge** — Caddy serving the NAV web application and the same-origin API.

Only `nav-edge` publishes host ports. Router, search, tiles and engine stay on the private backplane.

## First activation

```bash
cd products/izakhono-nav/stack
cp .env.example .env
# edit .env and set a strong NOMINATIM_PASSWORD
./scripts/activate.sh
./scripts/status.sh
./scripts/verify.sh
```

The bootstrap downloads the South Africa Geofabrik PBF once, verifies its MD5, and reuses the same source data for routing, search and map generation.

## Readiness language

- **BUILT / CI VERIFIED** means repository contracts, compatibility APIs and deployment manifests pass.
- **OWNED LIVE VERIFIED** means a real IZAKHONO-controlled runtime has completed imports/builds and `scripts/verify.sh` passes there.
- No machine name is part of the product contract.

## Privacy

The stack contains no analytics, advertising identifiers, behavioral profiling, raw search-query logging or automatic trip-history upload.
