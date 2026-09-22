# IZAKHONO MARKETING STACK — NODE 01

Owned-first runtime for the mandatory portfolio marketing flow.

```
portfolio product
      |
      v
IZAKHONO CREATE  /create/
      |
      | izakhono.marketing.package.v1
      v
IZAKHONO ADS     /ads/
      |
      v
approved external channels
```

## Local same-origin endpoint

After running `RUN-IZAKHONO-MARKETING-STACK.cmd`:

- Home: `http://127.0.0.1:8100/`
- CREATE: `http://127.0.0.1:8100/create/`
- ADS: `http://127.0.0.1:8100/ads/`
- Health: `http://127.0.0.1:8100/healthz`

The shared origin is intentional. CREATE writes the validated campaign package to browser local storage and routes the user directly to `/ads/`; ADS consumes and removes the handoff value. JSON export/import remains the portable fallback.

## Public edge

The intended owned public hostname is `marketing.izakhono.co.za`.

Do **not** call that hostname live until:

1. NODE 01 local health is green.
2. DNS for `marketing.izakhono.co.za` points to the owned public edge.
3. ports 80/443 and TLS are verified.
4. `https://marketing.izakhono.co.za/healthz` returns 200.
5. both `/create/` and `/ads/` render successfully.
6. browser handoff CREATE -> ADS is verified.
7. external ad-account publishing remains paused unless separately approved.

The Caddy example in this folder is deliberately not auto-imported into the live edge until DNS/TLS is ready.
