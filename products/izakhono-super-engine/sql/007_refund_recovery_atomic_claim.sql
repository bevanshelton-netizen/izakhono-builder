-- Atomic recovery leasing: exactly one worker may claim a due reconciliation operation.

create or replace function iz_claim_refund_recovery(
  p_refund_id text,
  p_claim_id text,
  p_claimed_at timestamptz,
  p_lease_seconds integer default 300
)
returns boolean
language plpgsql
security invoker
as $$
begin
  if p_refund_id is null or btrim(p_refund_id) = '' then
    raise exception 'Refund ID is required';
  end if;
  if p_claim_id is null or btrim(p_claim_id) = '' then
    raise exception 'Claim ID is required';
  end if;
  if p_lease_seconds < 30 or p_lease_seconds > 3600 then
    raise exception 'Recovery lease must be between 30 and 3600 seconds';
  end if;

  update iz_payment_refund_operations
     set recovery_claim_id = p_claim_id,
         recovery_claimed_at = p_claimed_at,
         updated_at = p_claimed_at
   where refund_id = p_refund_id
     and status = 'processing'
     and reconciliation_required = true
     and (next_reconciliation_at is null or next_reconciliation_at <= p_claimed_at)
     and (
       recovery_claim_id is null
       or recovery_claimed_at is null
       or recovery_claimed_at < p_claimed_at - make_interval(secs => p_lease_seconds)
     );

  return found;
end;
$$;

create or replace function iz_release_refund_recovery(
  p_refund_id text,
  p_claim_id text
)
returns boolean
language plpgsql
security invoker
as $$
begin
  update iz_payment_refund_operations
     set recovery_claim_id = null,
         recovery_claimed_at = null,
         updated_at = now()
   where refund_id = p_refund_id
     and recovery_claim_id = p_claim_id;

  return found;
end;
$$;

revoke all on function iz_claim_refund_recovery(text, text, timestamptz, integer) from public;
revoke all on function iz_release_refund_recovery(text, text) from public;
