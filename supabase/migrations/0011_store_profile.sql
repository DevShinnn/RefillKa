-- ARRP store profile: classification, pay plan, claimed date, partner IDs,
-- person/address/contact fields, and last-updated audit.

create sequence if not exists public.arrp_seq start with 1;

alter table public.stores
  add column if not exists store_code text,
  add column if not exists arrp_id text,
  add column if not exists classification text not null default 'sari_sari',
  add column if not exists pay_plan text not null default 'installment',
  add column if not exists claimed_on date,
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists dob date,
  add column if not exists house_no text not null default '',
  add column if not exists street text not null default '',
  add column if not exists village text not null default '',
  add column if not exists hoa text not null default '',
  add column if not exists district text not null default '',
  add column if not exists zip text not null default '',
  add column if not exists phone_alt text not null default '',
  add column if not exists contact_person text not null default '',
  add column if not exists contact_phone text not null default '',
  add column if not exists email text not null default '',
  add column if not exists facebook text not null default '',
  add column if not exists facebook_alt text not null default '',
  add column if not exists maps_url text not null default '',
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by uuid references public.profiles(id) on delete set null,
  add column if not exists updated_by_name text not null default '';

alter table public.stores drop constraint if exists stores_classification_check;
alter table public.stores add constraint stores_classification_check
  check (classification in ('sari_sari', 'independent_reseller'));

alter table public.stores drop constraint if exists stores_pay_plan_check;
alter table public.stores add constraint stores_pay_plan_check
  check (pay_plan in ('installment', 'fully_paid'));

create unique index if not exists stores_store_code_key on public.stores (store_code) where store_code is not null;
create unique index if not exists stores_arrp_id_key on public.stores (arrp_id) where arrp_id is not null;
create index if not exists stores_updated_idx on public.stores (updated_at desc);

-- Backfill connected IDs for existing rows (RK-0001 ↔ ARRP-0001).
do $$
declare
  r record;
  n int := 0;
begin
  for r in select id from public.stores order by created_at, name loop
    n := n + 1;
    update public.stores
      set
        store_code = coalesce(nullif(store_code, ''), 'RK-' || lpad(n::text, 4, '0')),
        arrp_id = coalesce(nullif(arrp_id, ''), 'ARRP-' || lpad(n::text, 4, '0')),
        updated_at = coalesce(updated_at, created_at)
      where id = r.id;
  end loop;
  if n > 0 then
    perform setval('public.arrp_seq', n, true);
  end if;
end $$;

create or replace function public.assign_store_codes()
returns trigger
language plpgsql
as $$
declare
  n bigint;
begin
  if new.store_code is null or btrim(new.store_code) = '' then
    n := nextval('public.arrp_seq');
    new.store_code := 'RK-' || lpad(n::text, 4, '0');
  end if;
  if new.arrp_id is null or btrim(new.arrp_id) = '' then
    if n is null then
      n := coalesce(nullif(regexp_replace(coalesce(new.store_code, ''), '\D', '', 'g'), '')::bigint, nextval('public.arrp_seq'));
    end if;
    new.arrp_id := 'ARRP-' || lpad(n::text, 4, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists stores_assign_codes on public.stores;
create trigger stores_assign_codes
  before insert on public.stores
  for each row execute function public.assign_store_codes();

create or replace function public.stamp_store_profile()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  if new.updated_by is null then
    new.updated_by := auth.uid();
  end if;
  if (new.updated_by_name is null or btrim(new.updated_by_name) = '') and new.updated_by is not null then
    select full_name into new.updated_by_name from public.profiles where id = new.updated_by;
    new.updated_by_name := coalesce(new.updated_by_name, '');
  end if;
  return new;
end;
$$;

drop trigger if exists stores_stamp_profile on public.stores;
create trigger stores_stamp_profile
  before insert or update on public.stores
  for each row execute function public.stamp_store_profile();
