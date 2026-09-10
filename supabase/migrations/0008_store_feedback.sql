-- 0008_store_feedback.sql
-- Timestamped feedback feed per store. Each post records who wrote it
-- (stamped server-side from the logging account) and when, so feedback is
-- an append-only log rather than a single overwritable text field.

create table if not exists public.store_feedback (
  id             uuid primary key default gen_random_uuid(),
  store_id       uuid not null references public.stores(id) on delete cascade,
  lgu_id         uuid not null references public.lgus(id),
  region_id      uuid not null references public.regions(id),
  topic          text not null default 'general' check (topic in ('product','service','general')),
  note           text not null check (length(btrim(note)) > 0),
  logged_by      uuid not null references public.profiles(id) default auth.uid(),
  logged_by_name text not null default '',
  logged_by_role public.user_role not null,
  created_at     timestamptz not null default now()
);
create index if not exists store_feedback_store_idx on public.store_feedback (store_id, created_at desc);
create index if not exists store_feedback_lgu_idx on public.store_feedback (lgu_id, created_at desc);

create or replace function public.stamp_store_feedback()
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

  if not public.app_sees_all() then
    if new.lgu_id is distinct from public.app_lgu() then
      raise exception 'You can only add feedback within your assigned LGU';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists stamp_store_feedback_ins on public.store_feedback;
create trigger stamp_store_feedback_ins
  before insert on public.store_feedback
  for each row execute function public.stamp_store_feedback();

alter table public.store_feedback enable row level security;

drop policy if exists store_feedback_read   on public.store_feedback;
drop policy if exists store_feedback_insert on public.store_feedback;
drop policy if exists store_feedback_delete on public.store_feedback;

create policy store_feedback_read on public.store_feedback for select using (
  auth.uid() is not null and (
    public.app_sees_all()
    or (public.app_role() = 'regional_exec' and region_id = public.app_region())
    or (lgu_id = public.app_lgu())
  )
);

create policy store_feedback_insert on public.store_feedback for insert with check (
  logged_by = auth.uid()
  and public.app_role() in ('cenro','lgu_admin','national_admin','superadmin')
);

create policy store_feedback_delete on public.store_feedback for delete using (
  public.app_is_national_admin()
  or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu())
  or (public.app_role() = 'cenro' and logged_by = auth.uid() and lgu_id = public.app_lgu())
);

do $$ begin
  alter publication supabase_realtime add table public.store_feedback;
exception when duplicate_object then null; end $$;
