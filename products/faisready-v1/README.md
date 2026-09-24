# FAISReady v1

FAISReady v1 is a mobile-first South African regulatory-exam preparation launch product built to run inside the owner-controlled IZAKHONO WORK workspace.

## Included

- RE1, RE3, RE4 and RE5 preparation sections
- R399 launch-offer positioning
- mobile-first blue, white and gold interface
- learner course selection
- interactive mock quiz with local scoring
- readiness/progress dashboard
- learner launch-list form
- employer/team enquiry form
- institutional pilot enquiry option
- local browser lead storage
- CSV lead export
- payment status visibly disabled until merchant and reconciliation controls are verified

## Local run

Open `index.html` directly, or serve the project through IZAKHONO WORK preview.

Expected owner preview:

`http://127.0.0.1:9393/preview/FAISReady-v1/`

## Data boundary

This launch build stores quiz history and enquiries in the browser's localStorage on the device running the page. This is intentionally a bootstrap-first setup, not a production CRM.

Before public launch, replace local lead storage with the approved owner-controlled persistence layer, add privacy/consent operations appropriate to the intended deployment, and test backup/export.

## Payment boundary

There is no active payment collection in v1. The R399 offer is presented as a launch-list offer only.

Do not add payment links or imply active checkout until the payment launch checklist in `PAYMENT-INTEGRATION.md` is satisfied.

## Claims boundary

FAISReady is an independent preparation product. It must not imply FSCA endorsement, guaranteed exam results, guaranteed passes or official exam administration.

## Current launch purpose

The goal of this version is to start generating measurable demand and leads immediately while the payment and production-service layers remain safely gated.


## Owner portal and merchandise

- Public owner route: `/owner/`
- Authentication: IZAKHONO Core project `faisready`; no owner password is embedded in browser source.
- Administrative CRM data is proxied server-side so `CRM_ADMIN_TOKEN` never enters the browser.
- Merchandise catalogue: `merch.json`.
- Merchandise orders enter the FAISReady-scoped IZAKHONO CRM pipeline through the server-side ingest token.
- A merchandise cart/order request is not payment confirmation.
- Merchandise checkout links remain fail-closed until an exact approved iKhokha production route is recorded.
- Run `PROVISION-FAISREADY-OWNER.sh` as root on NODE01 to create the initial owner account and fail-closed runtime environment.

## Owned publication

FAISReady now includes a NODE01 container contract in `.izakhono.json`. The commercial readiness endpoint is `/readiness`. It returns `commercial_ready=true` only when the NODE01 runtime has owner authentication and CRM order intake provisioned and the explicit commercial readiness flag is enabled after final acceptance.
