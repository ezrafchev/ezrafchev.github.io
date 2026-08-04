create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text,
  created_at timestamptz default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  customer_email text,
  status text default 'aguardando_pagamento',
  payment_provider text default 'mercado_pago',
  payment_id text,
  external_reference text unique,
  subtotal numeric(12,2) default 0,
  shipping_total numeric(12,2) default 0,
  total numeric(12,2) default 0,
  shipping_postal_code text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references public.orders(id) on delete cascade,
  name text not null,
  quantity integer not null default 1,
  unit_price numeric(12,2) not null default 0,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "profiles own select" on public.profiles for select using (auth.uid() = id);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id);
create policy "orders own select" on public.orders for select using (auth.uid() = user_id);
create policy "items own select" on public.order_items for select using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
