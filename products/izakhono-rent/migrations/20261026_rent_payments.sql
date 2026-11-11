create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.rent_bookings(id) on delete cascade,
  provider text not null check (provider in ('ikhokha')),
  provider_reference text,
  provider_event_id text,
  idempotency_key text not null unique,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','authorized','paid','failed','refunded')),
  raw_event_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, provider_event_id)
);

create index if not exists rent_payments_booking_idx on public.rent_payments(booking_id);
create index if not exists rent_payments_provider_ref_idx on public.rent_payments(provider, provider_reference);

alter table public.rent_payments enable row level security;

create policy "rent payments owner or renter read" on public.rent_payments
for select to authenticated
using (
  exists (
    select 1 from public.rent_bookings b
    where b.id = rent_payments.booking_id
      and ((select auth.uid()) = b.renter_id or exists (
        select 1 from public.rent_listings l
        where l.id = b.listing_id and l.owner_id = (select auth.uid())
      ))
  )
);

create policy "rent payments owner or renter insert" on public.rent_payments
for insert to authenticated
with check (
  exists (
    select 1 from public.rent_bookings b
    where b.id = rent_payments.booking_id
      and ((select auth.uid()) = b.renter_id or exists (
        select 1 from public.rent_listings l
        where l.id = b.listing_id and l.owner_id = (select auth.uid())
      ))
  )
);

create or replace function public.rent_touch_payment_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rent_payments_touch_updated_at on public.rent_payments;
create trigger rent_payments_touch_updated_at
before update on public.rent_payments
for each row execute function public.rent_touch_payment_updated_at();
