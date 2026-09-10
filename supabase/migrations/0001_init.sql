-- ============================================================
--  RefillKa — nationwide schema, security (RLS) and realtime
--
--  Tenancy hierarchy:  Region → LGU (city/municipality) → Store
--  Every collection is scoped to an LGU and a Region, and RLS
--  restricts each user to the data inside their own scope.
--
--  People who log data are CENRO staff (LGU field staff). Stores are
--  the SOURCE of the data — reference records that CENRO select when
--  logging — not login accounts.
--
--  Run in Supabase SQL Editor, or `supabase db push` with the CLI.
-- ============================================================

-- ---------- enums ----------
do $$ begin
  create type public.user_role as enum (
    'superadmin',     -- developer / platform owner: full control of everything
    'cenro',          -- LGU field staff: the people who log collections in the portal
    'lgu_admin',      -- admin for one LGU
    'lgu_exec',       -- read-only dashboard for one LGU (e.g. City Mayor)
    'regional_exec',  -- read-only dashboard for one region
    'national_admin', -- admin across all LGUs (HQ / DENR)
    'national_exec'   -- read-only national dashboard (CEO / Owner)
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.material_type as enum ('sachet','refill','pet','hdpe','ucoil','reuse');
exception when duplicate_object then null; end $$;

-- ---------- reference hierarchy ----------
create table if not exists public.regions (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,          -- NCR, R4A, R7, ...
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.lgus (
  id         uuid primary key default gen_random_uuid(),
  region_id  uuid not null references public.regions(id),
  name       text not null,
  kind       text not null default 'City',  -- City | Municipality
  created_at timestamptz not null default now(),
  unique (region_id, name)
);
create index if not exists lgus_region_idx on public.lgus (region_id);

-- Stores are the SOURCE of collected data (not login accounts).
create table if not exists public.stores (
  id         uuid primary key default gen_random_uuid(),
  lgu_id     uuid not null references public.lgus(id),
  name       text not null,
  barangay   text not null,
  channel    text not null default 'Sari-sari',
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists stores_lgu_idx on public.stores (lgu_id);

-- ---------- people (login accounts) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null default '',
  role       public.user_role not null default 'cenro',
  region_id  uuid references public.regions(id) on delete set null, -- set for regional_exec
  lgu_id     uuid references public.lgus(id) on delete set null,    -- set for CENRO / LGU roles
  created_at timestamptz not null default now()
);
create index if not exists profiles_lgu_idx on public.profiles (lgu_id);

-- ---------- the ledger ----------
create table if not exists public.collections (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id),   -- the source store
  lgu_id         uuid not null references public.lgus(id),     -- denormalized for fast scoped RLS
  region_id      uuid not null references public.regions(id),  -- denormalized for fast scoped RLS
  material       public.material_type not null,
  quantity       numeric not null check (quantity >= 0),
  unit           text not null,
  notes          text not null default '',
  logged_by      uuid not null references public.profiles(id) default auth.uid(),
  logged_by_name text not null default '',
  logged_by_role public.user_role not null,
  collected_at   timestamptz not null default now(),
  created_at     timestamptz not null default now()
);
create index if not exists collections_created_at_idx on public.collections (created_at desc);
create index if not exists collections_lgu_idx        on public.collections (lgu_id, created_at desc);
create index if not exists collections_region_idx     on public.collections (region_id, created_at desc);
create index if not exists collections_store_idx      on public.collections (store_id);
create index if not exists collections_logged_by_idx  on public.collections (logged_by);

-- ============================================================
--  Security-definer helpers (read the caller's scope without
--  tripping RLS recursion on profiles).
-- ============================================================
create or replace function public.app_role()
  returns public.user_role language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.app_lgu()
  returns uuid language sql stable security definer set search_path = public
as $$ select lgu_id from public.profiles where id = auth.uid() $$;

create or replace function public.app_region()
  returns uuid language sql stable security definer set search_path = public
as $$ select region_id from public.profiles where id = auth.uid() $$;

-- sees ALL data (no scope limit): superadmin + national roles
create or replace function public.app_sees_all()
  returns boolean language sql stable security definer set search_path = public
as $$ select public.app_role() in ('superadmin','national_admin','national_exec') $$;

-- national-level WRITE authority: superadmin + national_admin
create or replace function public.app_is_national_admin()
  returns boolean language sql stable security definer set search_path = public
as $$ select public.app_role() in ('superadmin','national_admin') $$;

-- has admin (write) capability at some scope
create or replace function public.app_is_admin()
  returns boolean language sql stable security definer set search_path = public
as $$ select public.app_role() in ('superadmin','national_admin','lgu_admin') $$;

-- ---------- auto-create profile on signup ----------
create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, region_id, lgu_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'cenro'),
    nullif(new.raw_user_meta_data->>'region_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'lgu_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- guard role / scope changes ----------
create or replace function public.protect_profile()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  editor_role public.user_role := public.app_role();
  editor_lgu  uuid := public.app_lgu();
begin
  -- Only a superadmin may create, keep, or remove the superadmin role.
  if (new.role = 'superadmin' or old.role = 'superadmin') and editor_role is distinct from 'superadmin' then
    raise exception 'Only a superadmin can manage superadmin accounts';
  end if;

  -- Superadmin and national admins have full control otherwise.
  if editor_role in ('superadmin','national_admin') then
    return new;
  end if;

  -- Any change to role or scope by a lower editor is tightly limited.
  if new.role      is distinct from old.role
     or new.region_id is distinct from old.region_id
     or new.lgu_id    is distinct from old.lgu_id then

    if editor_role = 'lgu_admin' then
      if new.region_id is distinct from old.region_id then
        raise exception 'Changing region requires a national admin';
      end if;
      if coalesce(new.lgu_id, editor_lgu) is distinct from editor_lgu then
        raise exception 'You can only manage accounts inside your own LGU';
      end if;
      if new.role not in ('cenro','lgu_admin','lgu_exec') then
        raise exception 'Assigning that role requires a national admin';
      end if;
    else
      raise exception 'You are not allowed to change roles or scope';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists protect_profile_update on public.profiles;
create trigger protect_profile_update
  before update on public.profiles
  for each row execute function public.protect_profile();

-- ---------- stamp + scope-check each collection on insert ----------
create or replace function public.stamp_collection()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  s_lgu    uuid;
  s_region uuid;
  p_name   text;
  p_role   public.user_role;
begin
  select s.lgu_id, l.region_id into s_lgu, s_region
    from public.stores s join public.lgus l on l.id = s.lgu_id
   where s.id = new.store_id;
  if s_lgu is null then raise exception 'Unknown store'; end if;

  new.lgu_id    := s_lgu;
  new.region_id := s_region;

  select coalesce(full_name, ''), role into p_name, p_role
    from public.profiles where id = new.logged_by;
  new.logged_by_name := p_name;
  new.logged_by_role := p_role;

  -- CENRO / LGU admins may only log within their assigned LGU.
  -- Superadmin + national admins may log anywhere.
  if not public.app_sees_all() then
    if new.lgu_id is distinct from public.app_lgu() then
      raise exception 'You can only log collections within your assigned LGU';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists stamp_collection_ins on public.collections;
create trigger stamp_collection_ins
  before insert on public.collections
  for each row execute function public.stamp_collection();

-- ============================================================
--  Row-Level Security
-- ============================================================
alter table public.regions     enable row level security;
alter table public.lgus        enable row level security;
alter table public.stores      enable row level security;
alter table public.profiles    enable row level security;
alter table public.collections enable row level security;

-- reference data: readable by any signed-in user; only national admins write
drop policy if exists regions_read  on public.regions;
drop policy if exists regions_write on public.regions;
create policy regions_read  on public.regions for select using (auth.uid() is not null);
create policy regions_write on public.regions for all
  using (public.app_is_national_admin()) with check (public.app_is_national_admin());

drop policy if exists lgus_read  on public.lgus;
drop policy if exists lgus_write on public.lgus;
create policy lgus_read  on public.lgus for select using (auth.uid() is not null);
create policy lgus_write on public.lgus for all
  using (public.app_is_national_admin()) with check (public.app_is_national_admin());

-- stores: visible within the caller's scope; admins manage their scope
drop policy if exists stores_read  on public.stores;
drop policy if exists stores_write on public.stores;
create policy stores_read on public.stores for select using (
  public.app_sees_all()
  or (public.app_role() = 'regional_exec'
      and lgu_id in (select id from public.lgus where region_id = public.app_region()))
  or (lgu_id = public.app_lgu())
);
create policy stores_write on public.stores for all
  using (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()))
  with check (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()));

-- profiles: read own; admins read/manage within scope
drop policy if exists profiles_read        on public.profiles;
drop policy if exists profiles_self_update  on public.profiles;
drop policy if exists profiles_admin_write  on public.profiles;
create policy profiles_read on public.profiles for select using (
  id = auth.uid()
  or public.app_is_national_admin()
  or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu())
);
create policy profiles_self_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_admin_write on public.profiles for all
  using (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()))
  with check (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()));

-- collections:
--   read   -> within the caller's scope (LGU / region / national)
--   insert -> cenro / lgu_admin / national_admin / superadmin (scope enforced by trigger)
--   update/delete -> admins, within their scope
drop policy if exists collections_read   on public.collections;
drop policy if exists collections_insert on public.collections;
drop policy if exists collections_update on public.collections;
drop policy if exists collections_delete on public.collections;

create policy collections_read on public.collections for select using (
  auth.uid() is not null and (
    public.app_sees_all()
    or (public.app_role() = 'regional_exec' and region_id = public.app_region())
    or (lgu_id = public.app_lgu())
  )
);

create policy collections_insert on public.collections for insert with check (
  logged_by = auth.uid()
  and public.app_role() in ('cenro','lgu_admin','national_admin','superadmin')
);

create policy collections_update on public.collections for update
  using (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()))
  with check (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()));

create policy collections_delete on public.collections for delete
  using (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()));

-- ---------- realtime ----------
do $$ begin
  alter publication supabase_realtime add table public.collections;
exception when duplicate_object then null; end $$;
