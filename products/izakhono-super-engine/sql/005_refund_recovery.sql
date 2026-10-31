-- Refund recovery: transport ambiguity must never be treated as a confirmed provider failure.
-- Existing processing operations become recoverable unknown operations.

alter table iz_payment_refund_operations
  add column if not exists reconciliation_required boolean not null default false,
  add column if not exists last_error text,
  add column if not exists resolved_at timestamptz;

create index if not exists iz_payment_refund_recovery_idx
  on iz_payment_refund_operations (updated_at)
  where reconciliation_required = true;

comment on column iz_payment_refund_operations.reconciliation_required is
  'True when provider outcome is ambiguous and must be reconciled before another external refund attempt.';
