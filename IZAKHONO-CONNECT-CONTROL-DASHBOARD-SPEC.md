# IZAKHONO CONNECT CONTROL™ — Dashboard Build Specification

## Purpose
Authenticated operations console for IZAKHONO CONNECT. It is the control layer above multiple connectivity providers and must never expose customer/order data publicly.

## Primary views
- Overview: active orders, pending coverage checks, provisioning exceptions, active services, provider health.
- Leads: new enquiries, qualification, address/service requirements, conversion state.
- Coverage: address checks, requested service type, candidate providers, confidence/status, manual fallback.
- Orders: order lifecycle, customer, product, selected provider, upstream reference, timestamps.
- Provisioning: state-machine queue with retries, attempts, output, errors and next action.
- Providers: provider registry, capability matrix, connection status, adapter status; credentials are never rendered.
- Products: CONNECT START/BUSINESS/SECURE/FLEET/ENTERPRISE and provider mappings.
- Exceptions: failed/blocked steps requiring operator action.
- Audit: immutable operational events.

## Provisioning state machine
`PAYMENT_VERIFIED → COVERAGE_CHECK → PROVIDER_SELECTION → SERVICE_ORDER → ACTIVATION → CUSTOMER_PORTAL → FORTRESS_SECURITY → HANDOVER`

Every state must be idempotent. A retry must not create duplicate upstream orders. Persist attempt count, status, timestamps, external reference, structured output and structured error.

## Provider adapter contract
```ts
interface ConnectProviderAdapter {
  checkCoverage(input: CoverageRequest): Promise<CoverageResult>;
  quote(input: QuoteRequest): Promise<QuoteResult>;
  createOrder(input: ProviderOrder): Promise<ProviderOrderResult>;
  getOrderStatus(reference: string): Promise<ProviderOrderStatus>;
  cancelOrder(reference: string): Promise<CancelResult>;
}
```

Provider adapters must be replaceable. If an upstream API is unavailable, route to a clearly marked manual-provider fallback. Never report a service as provisioned without verified upstream confirmation.

## Security boundaries
- Admin/operator authentication required.
- Role-based access: owner/admin/operator/support/read-only.
- Customer PII is restricted to authorized roles.
- Provider credentials and secrets stay server-side; never ship them to browser code.
- All state changes create audit events.
- Public lead capture remains separate from CONNECT CONTROL.

## UX principle
The dashboard should answer four questions immediately:
1. What needs attention?
2. Which customers are waiting?
3. Which provisioning steps are blocked?
4. Which provider/service should be used next?

## Build sequence
1. Authenticated shell and role gate.
2. Read-only operational dashboard backed by Supabase.
3. Leads/orders/provisioning/exception views.
4. Provider adapter registry.
5. Safe order/provisioning mutations.
6. Retry worker/queue.
7. Payment webhook integration.
8. Supplier API credentials and sandbox/test transactions.
9. Production supplier provisioning only after contractual/API verification.
