-- Automated refund recovery scheduling.
-- These fields never authorize a second external refund request; they only schedule lookup-only reconciliation.

alter table iz_payment_refund_operations
  add column if not exists recovery_attempt_count integer not null default 0,
  add column if not exists next_reconciliation_at timestamptz;

create index if not exists iz_payment_refund_recovery_due_idx
  on iz_payment_refund_operations (next_reconciliation_at, updated_at)
  where reconciliation_required = true and status = 'processing';

comment on column iz_payment_refund_operations.recovery_attempt_count is
  'Number of lookup-only reconciliation attempts made after an ambiguous provider outcome.';

comment on column iz_payment_refund_operations.next_reconciliation_at is
  'Earliest time a lookup-only reconciliation may be attempted again.';
