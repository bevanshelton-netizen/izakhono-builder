alter table iz_payment_refund_operations
  add column if not exists recovery_claim_id text,
  add column if not exists recovery_claimed_at timestamptz;

create index if not exists iz_payment_refund_recovery_claim_idx
  on iz_payment_refund_operations (reconciliation_required, next_reconciliation_at, recovery_claimed_at, updated_at)
  where reconciliation_required = true and status = 'processing';
