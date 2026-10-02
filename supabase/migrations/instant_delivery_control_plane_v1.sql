create table if not exists public.izakhono_delivery_projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  repository text,
  vercel_project text,
  supabase_project text,
  production_domain text,
  fallback_domain text,
  status text not null default 'planned'
    check (status in ('planned','building','verified','live','blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.izakhono_delivery_services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.izakhono_delivery_projects(id) on delete cascade,
  service_type text not null
    check (service_type in ('hosting','database','auth','storage','domain','dns','ssl','email','payments','monitoring','backup')),
  provider text not null,
  status text not null default 'ready'
    check (status in ('ready','needs_config','blocked','verified')),
  endpoint text,
  external_dependency boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, service_type)
);

create table if not exists public.izakhono_delivery_checks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.izakhono_delivery_projects(id) on delete cascade,
  check_type text not null,
  status text not null check (status in ('pass','fail','pending','blocked')),
  evidence text,
  checked_at timestamptz not null default now()
);

alter table public.izakhono_delivery_projects enable row level security;
alter table public.izakhono_delivery_services enable row level security;
alter table public.izakhono_delivery_checks enable row level security;
