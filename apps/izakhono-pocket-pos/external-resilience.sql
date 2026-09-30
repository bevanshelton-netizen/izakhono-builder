-- IZAKHONO PocketPOS external resilience schema (PostgreSQL/Supabase)
-- No secrets or one-time activation tokens belong in source control.

create table if not exists public.pp_merchants(
  id text primary key, slug text not null unique, legal_name text not null, trading_name text not null,
  currency text not null default 'ZAR', tax_rate numeric(6,3) not null default 15,
  created_at timestamptz not null default now()
);
create table if not exists public.pp_branches(
  id text primary key, merchant_id text not null references public.pp_merchants(id) on delete cascade,
  name text not null,address text,active boolean not null default true,created_at timestamptz not null default now()
);
create table if not exists public.pp_staff(
  id text primary key,merchant_id text not null references public.pp_merchants(id) on delete cascade,
  name text not null,email text,phone text,role text not null check(role in('owner','manager','supervisor','cashier')),
  pin_salt text,pin_hash text,disabled boolean not null default false,created_at timestamptz not null default now()
);
create unique index if not exists pp_staff_email_unique on public.pp_staff(merchant_id,lower(email)) where email is not null;
create unique index if not exists pp_staff_phone_unique on public.pp_staff(merchant_id,phone) where phone is not null;
create table if not exists public.pp_sessions(
  id text primary key,staff_id text not null references public.pp_staff(id) on delete cascade,
  token_hash text not null unique,expires_at timestamptz not null,created_at timestamptz not null default now(),revoked_at timestamptz
);
create table if not exists public.pp_devices(
  id text primary key,merchant_id text not null references public.pp_merchants(id) on delete cascade,
  branch_id text references public.pp_branches(id),label text,platform text,enrolled_at timestamptz not null default now(),revoked_at timestamptz
);
create table if not exists public.pp_customers(
  id text primary key,merchant_id text not null references public.pp_merchants(id) on delete cascade,
  name text not null,phone text,email text,created_at timestamptz not null default now()
);
create table if not exists public.pp_products(
  id text primary key,merchant_id text not null references public.pp_merchants(id) on delete cascade,
  sku text not null,barcode text,name text not null,price_minor integer not null check(price_minor>=0),
  active boolean not null default true,created_at timestamptz not null default now(),unique(merchant_id,sku)
);
create unique index if not exists pp_products_barcode_unique on public.pp_products(merchant_id,barcode) where barcode is not null and barcode<>'';
create table if not exists public.pp_inventory(
  branch_id text not null references public.pp_branches(id) on delete cascade,
  product_id text not null references public.pp_products(id) on delete cascade,
  on_hand integer not null default 0 check(on_hand>=0),updated_at timestamptz not null default now(),
  primary key(branch_id,product_id)
);
create table if not exists public.pp_sales(
  id text primary key,merchant_id text not null references public.pp_merchants(id),
  branch_id text not null references public.pp_branches(id),staff_id text not null references public.pp_staff(id),
  customer_id text references public.pp_customers(id),status text not null check(status in('pending','paid','void','refunded')),
  payment_method text not null,subtotal_minor integer not null,tax_minor integer not null,total_minor integer not null,
  external_payment_id text,idempotency_key text not null,created_at timestamptz not null default now(),paid_at timestamptz,
  unique(merchant_id,idempotency_key)
);
create table if not exists public.pp_sale_items(
  id text primary key,sale_id text not null references public.pp_sales(id) on delete cascade,
  product_id text references public.pp_products(id),description text not null,quantity integer not null check(quantity>0),
  unit_price_minor integer not null,line_total_minor integer not null
);
create table if not exists public.pp_payment_events(
  id text primary key,sale_id text not null references public.pp_sales(id) on delete cascade,
  provider text not null,provider_event_id text not null,event_type text not null,verified boolean not null default false,
  payload_json jsonb,created_at timestamptz not null default now(),unique(provider,provider_event_id)
);
create table if not exists public.pp_audit_log(
  id text primary key,merchant_id text not null references public.pp_merchants(id),staff_id text references public.pp_staff(id),
  device_id text references public.pp_devices(id),action text not null,entity_type text,entity_id text,metadata_json jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.pp_owner_activations(
  id text primary key,merchant_id text not null references public.pp_merchants(id) on delete cascade,
  token_hash text not null unique,expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now()
);

create index if not exists pp_sales_merchant_created on public.pp_sales(merchant_id,created_at desc);
create index if not exists pp_sales_branch_created on public.pp_sales(branch_id,created_at desc);
create index if not exists pp_audit_merchant_created on public.pp_audit_log(merchant_id,created_at desc);
create index if not exists pp_sessions_token_hash on public.pp_sessions(token_hash);

alter table public.pp_merchants enable row level security;
alter table public.pp_branches enable row level security;
alter table public.pp_staff enable row level security;
alter table public.pp_sessions enable row level security;
alter table public.pp_devices enable row level security;
alter table public.pp_customers enable row level security;
alter table public.pp_products enable row level security;
alter table public.pp_inventory enable row level security;
alter table public.pp_sales enable row level security;
alter table public.pp_sale_items enable row level security;
alter table public.pp_payment_events enable row level security;
alter table public.pp_audit_log enable row level security;
alter table public.pp_owner_activations enable row level security;

revoke all on public.pp_merchants,public.pp_branches,public.pp_staff,public.pp_sessions,public.pp_devices,
  public.pp_customers,public.pp_products,public.pp_inventory,public.pp_sales,public.pp_sale_items,
  public.pp_payment_events,public.pp_audit_log,public.pp_owner_activations from anon,authenticated;

create or replace function public.pp_create_sale(
  p_merchant_id text,p_branch_id text,p_staff_id text,p_customer_id text,p_idempotency_key text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_existing public.pp_sales%rowtype;v_item jsonb;v_product public.pp_products%rowtype;v_qty integer;
v_stock integer;v_subtotal integer:=0;v_tax integer:=0;v_rate numeric:=0;v_sale_id text:='sal_'||replace(gen_random_uuid()::text,'-','');
begin
  select * into v_existing from public.pp_sales where merchant_id=p_merchant_id and idempotency_key=p_idempotency_key limit 1;
  if found then return jsonb_build_object('idempotent',true,'id',v_existing.id,'status',v_existing.status,'total_minor',v_existing.total_minor,'tax_minor',v_existing.tax_minor); end if;
  if not exists(select 1 from public.pp_branches where id=p_branch_id and merchant_id=p_merchant_id and active=true) then raise exception 'branch_not_found'; end if;
  if p_customer_id is not null and not exists(select 1 from public.pp_customers where id=p_customer_id and merchant_id=p_merchant_id) then raise exception 'customer_not_found'; end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)<1 or jsonb_array_length(p_items)>100 then raise exception 'invalid_items'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,least(999,coalesce((v_item->>'quantity')::integer,0)));
    select * into v_product from public.pp_products where id=(v_item->>'product_id') and merchant_id=p_merchant_id and active=true;
    if not found then raise exception 'product_not_found'; end if;
    select on_hand into v_stock from public.pp_inventory where branch_id=p_branch_id and product_id=v_product.id;
    if coalesce(v_stock,0)<v_qty then raise exception 'insufficient_stock:%',v_product.id; end if;
    v_subtotal:=v_subtotal+(v_product.price_minor*v_qty);
  end loop;
  select tax_rate into v_rate from public.pp_merchants where id=p_merchant_id;
  if coalesce(v_rate,0)>0 then v_tax:=round(v_subtotal-(v_subtotal/(1+(v_rate/100.0)))); end if;
  insert into public.pp_sales(id,merchant_id,branch_id,staff_id,customer_id,status,payment_method,subtotal_minor,tax_minor,total_minor,idempotency_key)
  values(v_sale_id,p_merchant_id,p_branch_id,p_staff_id,p_customer_id,'pending','pending',v_subtotal,v_tax,v_subtotal,p_idempotency_key);
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty:=greatest(1,least(999,coalesce((v_item->>'quantity')::integer,0)));
    select * into v_product from public.pp_products where id=(v_item->>'product_id') and merchant_id=p_merchant_id and active=true;
    insert into public.pp_sale_items(id,sale_id,product_id,description,quantity,unit_price_minor,line_total_minor)
    values('itm_'||replace(gen_random_uuid()::text,'-',''),v_sale_id,v_product.id,v_product.name,v_qty,v_product.price_minor,v_product.price_minor*v_qty);
  end loop;
  insert into public.pp_audit_log(id,merchant_id,staff_id,action,entity_type,entity_id,metadata_json)
  values('aud_'||replace(gen_random_uuid()::text,'-',''),p_merchant_id,p_staff_id,'sale.create','sale',v_sale_id,jsonb_build_object('branch_id',p_branch_id,'total_minor',v_subtotal));
  return jsonb_build_object('idempotent',false,'id',v_sale_id,'status','pending','total_minor',v_subtotal,'tax_minor',v_tax);
end $$;

create or replace function public.pp_settle_sale(p_sale_id text,p_merchant_id text,p_staff_id text,p_method text,p_provider_id text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_sale public.pp_sales%rowtype;v_item record;v_stock integer;
begin
  select * into v_sale from public.pp_sales where id=p_sale_id and merchant_id=p_merchant_id for update;
  if not found then raise exception 'sale_not_found'; end if;
  if v_sale.status='paid' then return jsonb_build_object('ok',true,'idempotent',true,'sale_id',v_sale.id,'status','paid'); end if;
  if v_sale.status<>'pending' then raise exception 'sale_not_payable'; end if;
  for v_item in select product_id,quantity from public.pp_sale_items where sale_id=p_sale_id and product_id is not null loop
    select on_hand into v_stock from public.pp_inventory where branch_id=v_sale.branch_id and product_id=v_item.product_id for update;
    if coalesce(v_stock,0)<v_item.quantity then raise exception 'insufficient_stock:%',v_item.product_id; end if;
    update public.pp_inventory set on_hand=on_hand-v_item.quantity,updated_at=now() where branch_id=v_sale.branch_id and product_id=v_item.product_id;
  end loop;
  update public.pp_sales set status='paid',payment_method=p_method,external_payment_id=coalesce(p_provider_id,external_payment_id),paid_at=now() where id=p_sale_id;
  insert into public.pp_audit_log(id,merchant_id,staff_id,action,entity_type,entity_id,metadata_json)
  values('aud_'||replace(gen_random_uuid()::text,'-',''),p_merchant_id,p_staff_id,'sale.paid','sale',p_sale_id,jsonb_build_object('method',p_method,'provider_id',p_provider_id));
  return jsonb_build_object('ok',true,'idempotent',false,'sale_id',p_sale_id,'status','paid');
end $$;

create or replace function public.pp_activate_owner(
  p_token_hash text,p_owner_id text,p_name text,p_email text,p_phone text,p_pin_salt text,p_pin_hash text
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_activation public.pp_owner_activations%rowtype;
begin
  select * into v_activation from public.pp_owner_activations
  where token_hash=p_token_hash and used_at is null and expires_at>now() for update;
  if not found then raise exception 'activation_invalid_or_expired'; end if;
  if exists(select 1 from public.pp_staff where merchant_id=v_activation.merchant_id and role='owner' and disabled=false) then raise exception 'owner_already_active'; end if;
  insert into public.pp_staff(id,merchant_id,name,email,phone,role,pin_salt,pin_hash,disabled)
  values(p_owner_id,v_activation.merchant_id,nullif(trim(p_name),''),nullif(lower(trim(p_email)),''),nullif(trim(p_phone),''),'owner',p_pin_salt,p_pin_hash,false);
  update public.pp_owner_activations set used_at=now() where id=v_activation.id;
  insert into public.pp_audit_log(id,merchant_id,staff_id,action,entity_type,entity_id,metadata_json)
  values('aud_'||replace(gen_random_uuid()::text,'-',''),v_activation.merchant_id,p_owner_id,'owner.activate','staff',p_owner_id,jsonb_build_object('activation_id',v_activation.id));
  return jsonb_build_object('ok',true,'merchant_id',v_activation.merchant_id,'owner_id',p_owner_id);
end $$;

revoke all on function public.pp_create_sale(text,text,text,text,text,jsonb) from public,anon,authenticated;
revoke all on function public.pp_settle_sale(text,text,text,text,text) from public,anon,authenticated;
revoke all on function public.pp_activate_owner(text,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.pp_create_sale(text,text,text,text,text,jsonb) to service_role;
grant execute on function public.pp_settle_sale(text,text,text,text,text) to service_role;
grant execute on function public.pp_activate_owner(text,text,text,text,text,text,text) to service_role;
