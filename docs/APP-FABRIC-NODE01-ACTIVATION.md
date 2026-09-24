# APP FABRIC NODE01 Activation

This package takes IZAKHONO APP FABRIC from source-code readiness to an **owned internal runtime proof** without changing any public platform route.

## One-click owner-host action

On the Windows owner host, from the current `izakhono-builder` checkout:

```text
START-APP-FABRIC-NODE01.cmd
```

The launcher:

1. reuses the installed IZAKHONO owner-host / WSL foundation;
2. generates owner-only CRM and APP FABRIC secrets locally if they do not already exist;
3. builds CRM and APP FABRIC Gateway images from canonical source;
4. starts both services with durable named volumes;
5. requires healthy containers;
6. runs a **non-writing authenticated Gateway → CRM integration proof**;
7. writes `IZAKHONO-APP-FABRIC-NODE01-REPORT.json` to the Windows Desktop.

It does **not** change DNS, public EDGE routes or the existing public application deployments.

## Internal topology

```text
platform adapters
      |
      v
APP FABRIC Gateway
  public/shared network only where required
      |
      v
IZAKHONO CRM
  private network
      |
      +-- durable CRM volume

Gateway outbox
      +-- durable retry volume
```

Host loopback diagnostic ports are bound only to `127.0.0.1`:
- CRM: `18080`
- APP FABRIC: `18090`

They are not public-listening ports.

## Public EDGE stage

A reviewed template and fail-closed activation command are included:

```bash
sudo infra/app-fabric-runtime/prepare-edge.sh fabric.example.com "https://app1.example.com,https://app2.example.com"
```

That command only stages the EDGE fragment.

After the approved hostname resolves to the owned EDGE:

```bash
sudo infra/app-fabric-runtime/prepare-edge.sh fabric.example.com "https://app1.example.com,https://app2.example.com" --apply
```

The apply mode enables browser public intake, keeps originless requests denied, validates and reloads Caddy, then requires a real public HTTPS health response.

## Promotion rule

Do not label APP FABRIC public or a product "connected" from container health alone.

Required promotion chain:

```text
SOURCE BUILT
→ NODE01 INTERNAL PASS
→ EDGE/TLS PASS
→ platform origin allow-listed
→ real platform event reaches correct scoped CRM pipeline
→ CONNECTED VERIFIED
```

Payment success remains outside the public intake API. Payment-confirmed states must still come from each product's verified payment/reconciliation route.
