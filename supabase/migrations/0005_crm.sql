-- ============================================================
--  RefillKa CRM — store profiles + weekly installment collections
--  Installment: ₱550 per week
-- ============================================================

alter table public.stores add column if not exists address text not null default '';
alter table public.stores add column if not exists phone text not null default '';
alter table public.stores add column if not exists age integer;
alter table public.stores add column if not exists gender text;
alter table public.stores add column if not exists will_reorder boolean;
alter table public.stores add column if not exists feedback_product text not null default '';
alter table public.stores add column if not exists feedback_service text not null default '';

alter table public.stores drop constraint if exists stores_gender_check;
alter table public.stores add constraint stores_gender_check
  check (gender is null or gender in ('F', 'M'));
alter table public.stores drop constraint if exists stores_age_check;
alter table public.stores add constraint stores_age_check
  check (age is null or (age >= 1 and age <= 120));

-- CENRO may register and update stores inside their LGU
drop policy if exists stores_cenro_insert on public.stores;
create policy stores_cenro_insert on public.stores for insert
  with check (public.app_role() = 'cenro' and lgu_id = public.app_lgu());

drop policy if exists stores_cenro_update on public.stores;
create policy stores_cenro_update on public.stores for update
  using (public.app_role() = 'cenro' and lgu_id = public.app_lgu())
  with check (public.app_role() = 'cenro' and lgu_id = public.app_lgu());

create table if not exists public.payments (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id),
  lgu_id         uuid not null references public.lgus(id),
  region_id      uuid not null references public.regions(id),
  amount         numeric not null default 550 check (amount >= 0),
  paid_on        date not null default (timezone('Asia/Manila', now()))::date,
  week_start     date not null,
  notes          text not null default '',
  logged_by      uuid not null references public.profiles(id) default auth.uid(),
  logged_by_name text not null default '',
  logged_by_role public.user_role not null,
  created_at     timestamptz not null default now(),
  unique (store_id, week_start)
);
create index if not exists payments_paid_on_idx on public.payments (paid_on desc);
create index if not exists payments_lgu_idx on public.payments (lgu_id, paid_on desc);
create index if not exists payments_store_idx on public.payments (store_id, week_start desc);

create or replace function public.stamp_payment()
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
  new.week_start := (date_trunc('week', new.paid_on::timestamp))::date;

  select coalesce(full_name, ''), role into p_name, p_role
    from public.profiles where id = new.logged_by;
  new.logged_by_name := p_name;
  new.logged_by_role := p_role;

  if not public.app_sees_all() then
    if new.lgu_id is distinct from public.app_lgu() then
      raise exception 'You can only collect within your assigned LGU';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists stamp_payment_ins on public.payments;
create trigger stamp_payment_ins
  before insert on public.payments
  for each row execute function public.stamp_payment();

alter table public.payments enable row level security;

drop policy if exists payments_read   on public.payments;
drop policy if exists payments_insert on public.payments;
drop policy if exists payments_update on public.payments;
drop policy if exists payments_delete on public.payments;

create policy payments_read on public.payments for select using (
  auth.uid() is not null and (
    public.app_sees_all()
    or (public.app_role() = 'regional_exec' and region_id = public.app_region())
    or (lgu_id = public.app_lgu())
  )
);

create policy payments_insert on public.payments for insert with check (
  logged_by = auth.uid()
  and public.app_role() in ('cenro','lgu_admin','national_admin','superadmin')
);

create policy payments_update on public.payments for update
  using (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()))
  with check (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()));

create policy payments_delete on public.payments for delete
  using (public.app_is_national_admin() or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu()));

do $$ begin
  alter publication supabase_realtime add table public.payments;
exception when duplicate_object then null; end $$;
