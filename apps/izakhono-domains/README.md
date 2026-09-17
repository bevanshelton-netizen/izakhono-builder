# IZAKHONO DOMAINS

African-built domain search and registrar storefront starter.

## What works now
- domain discovery via server-side RDAP lookup
- clear registered / possibly available / unknown states
- registrar connection status
- payment gate that refuses checkout until registrar provisioning and iKhokha are both configured
- Docker/Node deployment for owner-controlled infrastructure

## Production integration
Set these only as server-side secrets:
- `DOMAIN_REGISTRAR_API_URL`
- `DOMAIN_REGISTRAR_API_TOKEN`
- `IKHOKHA_CHECKOUT_URL`

The intended registrar integration is a white-label reseller API first (for example CentralNic Reseller or OpenSRS). Direct ZARC `.co.za` accreditation and later ICANN accreditation can be pursued separately.

## Run
`npm start`

Health: `/health`
