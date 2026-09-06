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
