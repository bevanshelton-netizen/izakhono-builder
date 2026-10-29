# I-CONNECT Staging API Integration Contract

## Purpose
Connect the dedicated I-CONNECT staging frontend to the controlled Core API without exposing production carrier, payment, RICA, identity, or banking credentials.

## Environment

The staging client must use `I_CONNECT_API_BASE_URL` and must never hard-code a production API URL.

Required simulation modes:

- `PAYMENT_ADAPTER_MODE=simulation`
- `NETWORK_ADAPTER_MODE=simulation`
- `RICA_ADAPTER_MODE=simulation`

## Synthetic journey

1. `GET /health` — API reachable.
2. `GET /ready` — dependencies ready.
3. `GET /api/v1/plans` — plans/catalogue available.
4. `POST /api/v1/customers` — create synthetic customer.
5. `POST /api/v1/orders` — create synthetic order.
6. `POST /api/v1/payments/webhook` — submit an idempotent simulated payment event.
7. Verify order transitions to `READY_TO_PROVISION`.
8. `POST /api/v1/provisioning/jobs` — start simulated provisioning.
9. Verify order transitions to `PROVISIONING`.
10. Read order/dashboard state and confirm audit/operations visibility.

## Safety rules

- Synthetic data only.
- No real SIM/eSIM activation.
- No production carrier API calls.
- No production RICA submission.
- No production payment capture.
- Do not expose service-role or database credentials to browser code.
- Treat any missing API configuration as a failed integration gate, not as a fallback to production.

## Release gate

The integration is GREEN only after the complete synthetic journey is executed through the application/API path and independently verified. A green staging integration is not commercial launch, MVNO activation, or ICASA approval.
