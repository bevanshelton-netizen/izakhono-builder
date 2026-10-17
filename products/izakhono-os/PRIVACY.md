# IZAKHONO OS Privacy Guarantee

## The guarantee

**IZAKHONO OS itself will not track you.**

For an official privacy-approved IZAKHONO OS release, IZAKHONO-controlled software must transmit **zero behavioural telemetry, zero advertising identifiers, zero profiling data and zero silent analytics** by default.

This is the scope of the IZAKHONO Privacy Guarantee.

No operating system can truthfully guarantee that websites, internet providers, independently installed applications, mobile networks, routers, hardware firmware or other third parties will never track a user. IZAKHONO OS must therefore also provide strong anti-tracking defaults and make third-party network activity easier to understand and control.

## Prohibited

Official IZAKHONO OS components may not include:

- behavioural telemetry
- advertising IDs
- user profiling
- cross-app tracking
- hidden persistent identifiers for analytics
- silent crash-report uploads
- third-party analytics SDKs
- tracking pixels
- background audience measurement
- sale of user activity
- sharing of user activity for advertising
- background AI prompt collection

## Privacy by default

The system must be useful without:
- an IZAKHONO cloud account
- a Microsoft account
- a Google account
- an advertising profile
- an analytics consent banner

Local accounts and local files are first-class features.

## Browser privacy

The bundled browser must ship with:
- browser telemetry disabled
- browser studies/experiments disabled
- tracking protection enabled
- background discovery/promotion features disabled where technically supported
- no IZAKHONO tracking extension
- no IZAKHONO advertising extension

Users remain free to install another browser.

## Network transparency

A network connection is permitted only when required for an explicit feature such as:

- user-requested web browsing
- software installation
- security updates
- firmware updates
- user-configured cloud sync
- user-configured email or messaging

Every IZAKHONO-owned network service must be documented in the human-readable `NETWORK-LEDGER.md` with:

- destination
- purpose
- data category
- whether it is optional
- how the user can disable it

An undocumented IZAKHONO-controlled endpoint blocks privacy approval.

## AI privacy

Ask IZAKHONO must prefer on-device processing for private system tasks.

If a cloud model is ever offered:
- cloud use must be visibly identified
- content may leave the device only after explicit user action
- the destination must be identified
- IZAKHONO must not add background prompt logging
- private local files must not be uploaded without explicit per-action approval
- cloud AI must be switchable off

## Diagnostics

Diagnostics are local-first.

Automatic diagnostic and crash submission is disabled by default.

A diagnostic bundle may leave the device only after the user deliberately exports or sends it.

## Privacy status

Easy Center must expose a visible **Privacy** control showing the system privacy promise and current release status.

Future releases should expand this into a local network-activity viewer and permissions dashboard.

## Release gate

An official release is **PRIVACY APPROVED** only when automated and human review confirm:

- no IZAKHONO analytics SDK exists
- no IZAKHONO telemetry endpoint exists
- no advertising identifier exists
- browser telemetry/studies are disabled
- automatic crash upload is disabled
- all IZAKHONO-controlled endpoints are declared in the network ledger
- no new tracking dependency was introduced
- privacy controls remain accessible from Easy Center

If any check fails, the build must not carry the privacy-approved label.

## User promise

IZAKHONO OS is designed so the computer works for the person using it — not so the person becomes the product.
