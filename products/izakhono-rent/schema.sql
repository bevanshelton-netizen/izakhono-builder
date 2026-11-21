-- IZAKHONO RENT™ transactional foundation
-- Designed for Supabase/Postgres; production commerce remains gated until payment/KYC integrations are connected.
create extension if not exists pgcrypto;

create table if not exists rent_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  role text not null default 'renter' check (role in ('renter','owner','business','admin')),
  display_name text,
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rent_listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  title text not null,
  description text,
  category text not null,
  subcategory text,
  location_text text,
  country_code text not null default 'ZA',
  currency text not null default 'ZAR',
  rental_period text not null default 'day' check (rental_period in ('hour','day','week','month')),
  rental_price numeric(14,2) not null check (rental_price >= 0),
  sale_price numeric(14,2),
  rent_to_own_enabled boolean not null default false,
  deposit_amount numeric(14,2) not null default 0 check (deposit_amount >= 0),
  status text not null default 'draft' check (status in ('draft','published','paused','archived')),
  verification_status text not null default 'pending' check (verification_status in ('pending','verified','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists rent_listing_media (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references rent_listings(id) on delete cascade,
  storage_path text not null,
  media_type text not null default 'image',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists rent_availability (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references rent_listings(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'available' check (status in ('available','blocked','reserved')),
  check (ends_at > starts_at)
);

create table if not exists rent_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references rent_listings(id),
  renter_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  subtotal numeric(14,2) not null check (subtotal >= 0),
  service_fee numeric(14,2) not null default 0 check (service_fee >= 0),
  deposit_amount numeric(14,2) not null default 0 check (deposit_amount >= 0),
  total_amount numeric(14,2) not null check (total_amount >= 0),
  currency text not null default 'ZAR',
  status text not null default 'pending' check (status in ('pending','confirmed','active','returned','cancelled','disputed','completed')),
  payment_status text not null default 'pending' check (payment_status in ('pending','authorized','paid','partially_refunded','refunded','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create table if not exists rent_handover_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references rent_bookings(id) on delete cascade,
  event_type text not null check (event_type in ('pickup','return','inspection','damage_report')),
  notes text,
  evidence_path text,
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists rent_disputes (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references rent_bookings(id) on delete cascade,
  opened_by uuid not null,
  reason text not null,
  status text not null default 'open' check (status in ('open','under_review','resolved_owner','resolved_renter','closed')),
  resolution_notes text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists rent_listings_category_idx on rent_listings(category);
create index if not exists rent_listings_status_idx on rent_listings(status);
create index if not exists rent_listings_owner_idx on rent_listings(owner_id);
create index if not exists rent_bookings_listing_idx on rent_bookings(listing_id);
create index if not exists rent_bookings_renter_idx on rent_bookings(renter_id);
create index if not exists rent_bookings_dates_idx on rent_bookings(starts_at, ends_at);
