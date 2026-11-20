# Regula proof-of-concept acceptance plan

Regula remains disabled in production configuration. Run this plan only under an approved evaluation agreement, using synthetic, vendor-provided or specifically authorised test data.

## Document matrix

- South African smart ID card: front and back capture, OCR, authenticity, chip/NFC where supported.
- South African green ID book: all relevant pages and security checks.
- South African passport: identity page, machine-readable zone and chip/NFC where supported.
- Foreign passports: selected representative issuing countries and document types.
- Expired, damaged, low-light, glare, cropped and rotated samples.
- Altered, counterfeit and mismatched test specimens supplied for controlled evaluation.

## Biometric matrix

- face match across supported capture conditions;
- passive and active liveness where offered;
- replay, print, screen and mask attack tests using approved lab methods;
- failure, inconclusive and manual-review outcomes;
- accessibility and alternative verification path.

## Integration matrix

- SDK/API version pinning and supported platforms;
- authentication, token scope and secret rotation;
- webhook signature verification against official vendor examples;
- idempotency and duplicate callback behaviour;
- timeouts, retries, provider outage and failover;
- evidence export, data portability and verified deletion;
- cloud, private-cloud and on-premises deployment comparisons.

## Acceptance criteria

The POC report must contain the test set provenance, measured document and biometric outcomes, false acceptance / false rejection findings where statistically meaningful, inconclusive rate, latency, uptime observations, security review, data-flow map, cost per successful verification and unresolved limitations.

No unsupported accuracy or coverage claims may be made. Product capability labels remain empty until verified against the selected Regula product, contract and South African test evidence.
