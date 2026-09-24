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

Neither service publishes a host port.

- CRM is reachable only on the private IZAKHONO Docker network.
- APP FABRIC is reachable by the owned Caddy/EDGE container on the shared IZAKHONO Docker network.
- Runtime diagnostics execute inside the containers, so no host-side admin port has to be exposed.

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


## Hybrid external resilience

APP FABRIC now has an already-verified external bridge on the existing IZAKHONO WebStart infrastructure:

`https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-gateway-event`

The operating order is:

```text
product
  -> owned APP FABRIC endpoint when verified/reachable
  -> external resilience bridge on failure/unavailability
  -> durable external event/opportunity mirror
  -> automatic forwarding attempt to owned APP FABRIC
  -> small queued-backlog flush on later events
```

The external bridge does not replace the owned engine. It preserves commercial intake while NODE01/EDGE is unavailable and automatically attempts to hand accepted events back to the owned endpoint.

Public payment confirmation is deliberately excluded from both browser-facing APP FABRIC routes. Payment truth stays with the product's verified payment and reconciliation path.
