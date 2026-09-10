-- Website improvement suggestions from CENRO (and other field staff).
-- Superadmin can read all rows; CENRO reads and deletes their own.

create table if not exists public.app_feedback (
  id             uuid primary key default gen_random_uuid(),
  lgu_id         uuid references public.lgus(id),
  region_id      uuid references public.regions(id),
  topic          text not null default 'suggestion' check (topic in ('suggestion','bug','other')),
  note           text not null check (length(btrim(note)) > 0),
  logged_by      uuid not null references public.profiles(id) default auth.uid(),
  logged_by_name text not null default '',
  logged_by_role public.user_role not null,
  created_at     timestamptz not null default now()
);
create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);
create index if not exists app_feedback_by_idx on public.app_feedback (logged_by, created_at desc);

create or replace function public.stamp_app_feedback()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  p_name text;
  p_role public.user_role;
  p_lgu  uuid;
  p_reg  uuid;
begin
  select coalesce(full_name, ''), role, lgu_id, region_id
    into p_name, p_role, p_lgu, p_reg
    from public.profiles where id = new.logged_by;
  new.logged_by_name := p_name;
  new.logged_by_role := p_role;
  new.lgu_id := coalesce(new.lgu_id, p_lgu);
  new.region_id := coalesce(new.region_id, p_reg);
  return new;
end $$;

drop trigger if exists stamp_app_feedback_ins on public.app_feedback;
create trigger stamp_app_feedback_ins
  before insert on public.app_feedback
  for each row execute function public.stamp_app_feedback();

alter table public.app_feedback enable row level security;

drop policy if exists app_feedback_read   on public.app_feedback;
drop policy if exists app_feedback_insert on public.app_feedback;
drop policy if exists app_feedback_delete on public.app_feedback;

create policy app_feedback_read on public.app_feedback for select using (
  auth.uid() is not null and (
    logged_by = auth.uid()
    or public.app_sees_all()
  )
);

create policy app_feedback_insert on public.app_feedback for insert with check (
  logged_by = auth.uid()
  and public.app_role() in ('cenro','lgu_admin','national_admin','superadmin')
);

create policy app_feedback_delete on public.app_feedback for delete using (
  logged_by = auth.uid()
  or public.app_is_national_admin()
);

do $$ begin
  alter publication supabase_realtime add table public.app_feedback;
exception when duplicate_object then null; end $$;
