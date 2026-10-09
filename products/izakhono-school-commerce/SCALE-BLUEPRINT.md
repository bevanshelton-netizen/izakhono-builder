# IZAKHONO School Commerce — Scale Blueprint

## Revenue lanes
- Bulk school procurement: 100–50,000+ units
- Parent retail / over-the-counter
- Uniform-shop wholesale
- Reseller/distributor
- Custom school-branded manufacturing
- Annual replenishment contracts

## Core entities
schools, school_brands, product_catalogue, product_variants, size_runs, price_tiers, stock_locations, inventory, customers, organisations, quotes, quote_lines, orders, order_lines, invoices, payments, production_jobs, fulfilment_jobs, deliveries, reseller_accounts, contracts, campaigns, leads.

## Order states
DRAFT → QUOTED → APPROVED → INVOICED → PAID/DEPOSIT_PAID → ALLOCATED → PRODUCTION → QC → PACKED → DISPATCHED → DELIVERED → REPEAT_READY.

## Bulk pricing
Use quantity breaks per SKU and customer tier. Never hard-code a single discount: pricing must be configurable by product, school, reseller, region and contract.

## AI workers
1. Merchandising worker — creates bundles and school catalogues.
2. Sales worker — qualifies buyers and converts enquiries.
3. Quote worker — creates size/quantity matrices and quotes.
4. Procurement worker — forecasts demand and supplier requirements.
5. Production worker — converts paid orders into manufacturing jobs.
6. Inventory worker — watches stock and replenishment.
7. Fulfilment worker — coordinates packing and delivery.
8. Marketing worker — creates school-season campaigns.
9. Customer-care worker — handles order status and repeat orders.
10. Finance worker — reconciles invoices, deposits and balances.
11. Tender worker — prepares procurement/tender response packs.
12. Analytics worker — measures margin, conversion, velocity and school lifetime value.

## Phase 2 acceptance criteria
- Product catalogue with SKU, size, colour, school and brand attributes.
- Bulk quote builder with CSV import.
- Quote PDF/email workflow.
- Customer accounts and school-specific catalogues.
- Inventory and low-stock alerts.
- Payment integration behind an adapter interface.
- CRM lead pipeline.
- Repeat-order button.
- Admin dashboard.
- Audit log and role-based access.
- API endpoints suitable for IZAKHONO Provisioner.
- Provider adapters remain replaceable; owned infrastructure remains the preferred runtime.

## Scale target
The system should be designed around the business case of thousands of schools, millions of line items and high-volume seasonal spikes, rather than a single-store assumption.
