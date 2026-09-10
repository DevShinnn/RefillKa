-- ============================================================
--  RefillKa product catalog (CENRO selects these on a reorder)
-- ============================================================

create table if not exists public.products (
  id                   uuid primary key default gen_random_uuid(),
  category             text not null check (category in ('food', 'nonfood')),
  name                 text not null unique,
  pack_qty             text not null default '1 gallon',
  price_refill         numeric not null check (price_refill >= 0),
  price_with_container numeric not null check (price_with_container >= 0),
  active               boolean not null default true,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now()
);

alter table public.collections
  add column if not exists product_id uuid references public.products(id);
alter table public.collections
  add column if not exists with_container boolean not null default false;
alter table public.collections
  add column if not exists unit_price numeric;

create index if not exists collections_product_idx on public.collections (product_id);

alter table public.products enable row level security;

drop policy if exists products_read  on public.products;
drop policy if exists products_write on public.products;
create policy products_read  on public.products for select using (auth.uid() is not null);
create policy products_write on public.products for all
  using (public.app_is_national_admin()) with check (public.app_is_national_admin());

insert into public.products (category, name, pack_qty, price_refill, price_with_container, sort_order) values
  ('food',    'Datu Puti Soy Sauce',            '1 gallon', 205, 255, 10),
  ('food',    'Datu Puti Vinegar',              '1 gallon', 160, 210, 20),
  ('food',    'Golden Fiesta Cooking Palm Oil', '1 gallon', 517, 547, 30),
  ('nonfood', 'Dishwashing Liquid',             '1 gallon', 280, 330, 40),
  ('nonfood', 'Liquid Laundry Detergent',       '1 gallon', 300, 350, 50),
  ('nonfood', 'Fabric Conditioner',             '1 gallon', 320, 370, 60),
  ('nonfood', 'All Purpose Cleaner',            '1 gallon', 300, 350, 70),
  ('nonfood', 'Liquid Hand Soap',               '1 gallon', 300, 350, 80),
  ('nonfood', 'Kojic Body Wash',                '1 gallon', 550, 600, 90),
  ('nonfood', 'Pet Shampoo',                    '1 gallon', 300, 350, 100),
  ('nonfood', 'Isopropyl Alcohol',              '1 gallon', 450, 500, 110),
  ('nonfood', 'Hand Sanitizer',                 '1 gallon', 350, 400, 120),
  ('nonfood', 'Hair Shampoo',                   '1 gallon', 790, 840, 130),
  ('nonfood', 'Hair Conditioner',               '1 gallon', 820, 870, 140)
on conflict (name) do update set
  category             = excluded.category,
  pack_qty             = excluded.pack_qty,
  price_refill         = excluded.price_refill,
  price_with_container = excluded.price_with_container,
  sort_order           = excluded.sort_order,
  active               = true;
