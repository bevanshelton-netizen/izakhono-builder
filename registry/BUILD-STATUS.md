# IZAKHONO REGISTRY STATUS

## Implemented control-plane foundation

- TLD-agnostic registry core with domain lifecycle state machine.
- Private/test namespace support.
- EPP command handling foundation.
- RDAP-shaped lookup responses.
- Persistent D1 domain/contact/host/audit storage.
- Persistent idempotency records.
- Persistent registrar records with active/suspended state.
- Authenticated registrar provisioning endpoint.
- Authenticated domain creation requiring an active registrar.
- Authenticated lifecycle transition endpoint.
- Web Crypto bearer-token verification.
- Worker deployment configuration and D1 migration.
- CI workflow for registry typecheck and Wrangler dry-run.
- DNS provisioning orchestration and provider contract.
- External authority adapter boundary with explicit confirmation state.
- Registration transaction orchestration that refuses to advance to `ok` without authority confirmation and successful DNS publication.
- Rate-limit abstraction and abuse-control foundation.

## Release truth

Public domain registration is NOT marked LIVE until the complete authoritative path has been tested:

Customer → IZAKHONO DOMAIN → Registrar/Registry Engine → Authoritative Registry → Registration confirmed → DNS provisioned → RDAP verified → Customer handover.

The current code is a registry/registrar control-plane foundation and does not by itself create public .co.za authority or root-zone delegation.

## Remaining production gates

1. Run and verify GitHub CI.
2. Verify the configured D1 database and apply migration remotely.
3. Deploy the Worker and verify health, domain check/create, RDAP and EPP endpoints.
4. Establish a real DNS provider adapter and verify publish/remove behavior. The provider contract and provisioning orchestration are now implemented; live verification remains outstanding.
5. Implement authoritative external registry adapter(s), beginning with the applicable .co.za registrar path once credentials/accreditation exist. The transport/adapter boundary is now implemented; live authority credentials and verification remain outstanding.
6. Add production registrar authentication/credential rotation, rate limiting, abuse controls, and operational alerting.
7. Complete end-to-end transaction, DNS, RDAP and customer-handover tests.
8. Only after those gates pass, expose customer-facing paid public registration.

## Commercial rule

NO VERIFIED CAPABILITY → NO CUSTOMER PROMISE → NO SALE.
