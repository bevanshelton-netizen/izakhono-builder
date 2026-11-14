-- Immutable checkout terms used by verified payment fulfillment.
create table if not exists public.iz_checkout_orders (
  order_id text primary key,
  payment_intent_id text not null unique,
  external_transaction_id text not null unique,
  customer_id text not null,
  domain text not null,
  expected_amount_minor bigint not null check (expected_amount_minor > 0),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  idempotency_key text not null unique,
  product_id text not null,
  created_at timestamptz not null,
  constraint iz_checkout_orders_domain_normalized check (
    domain = lower(domain) and domain !~ '[/:[:space:]]' and length(domain) <= 253
  )
);

create or replace function public.reject_iz_checkout_order_mutation()
returns trigger language plpgsql as $$
begin
  raise exception 'Checkout order snapshots are immutable; create a new order instead';
end;
$$;

drop trigger if exists iz_checkout_orders_immutable on public.iz_checkout_orders;
create trigger iz_checkout_orders_immutable
before update or delete on public.iz_checkout_orders
for each row execute function public.reject_iz_checkout_order_mutation();

alter table public.iz_checkout_orders enable row level security;
revoke all on public.iz_checkout_orders from anon, authenticated;
grant select, insert on public.iz_checkout_orders to service_role;
