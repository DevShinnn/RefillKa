-- Ops replies to store visit notes and CENRO website suggestions.

create table if not exists public.feedback_replies (
  id                  uuid primary key default gen_random_uuid(),
  store_feedback_id   uuid references public.store_feedback(id) on delete cascade,
  app_feedback_id     uuid references public.app_feedback(id) on delete cascade,
  note                text not null check (length(btrim(note)) > 0),
  logged_by           uuid not null references public.profiles(id) default auth.uid(),
  logged_by_name      text not null default '',
  logged_by_role      public.user_role not null,
  created_at          timestamptz not null default now(),
  constraint feedback_replies_one_parent check (
    (store_feedback_id is not null and app_feedback_id is null)
    or (store_feedback_id is null and app_feedback_id is not null)
  )
);
create index if not exists feedback_replies_store_idx on public.feedback_replies (store_feedback_id, created_at);
create index if not exists feedback_replies_app_idx on public.feedback_replies (app_feedback_id, created_at);

create or replace function public.stamp_feedback_reply()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  p_name text;
  p_role public.user_role;
begin
  select coalesce(full_name, ''), role into p_name, p_role
    from public.profiles where id = new.logged_by;
  new.logged_by_name := p_name;
  new.logged_by_role := p_role;
  return new;
end $$;

drop trigger if exists stamp_feedback_reply_ins on public.feedback_replies;
create trigger stamp_feedback_reply_ins
  before insert on public.feedback_replies
  for each row execute function public.stamp_feedback_reply();

alter table public.feedback_replies enable row level security;

drop policy if exists feedback_replies_read   on public.feedback_replies;
drop policy if exists feedback_replies_insert on public.feedback_replies;
drop policy if exists feedback_replies_delete on public.feedback_replies;

create policy feedback_replies_read on public.feedback_replies for select using (
  auth.uid() is not null and (
    public.app_sees_all()
    or (
      store_feedback_id is not null and exists (
        select 1 from public.store_feedback f
        where f.id = store_feedback_id
          and (
            public.app_role() = 'regional_exec' and f.region_id = public.app_region()
            or f.lgu_id = public.app_lgu()
          )
      )
    )
    or (
      app_feedback_id is not null and exists (
        select 1 from public.app_feedback f
        where f.id = app_feedback_id
          and f.logged_by = auth.uid()
      )
    )
  )
);

create policy feedback_replies_insert on public.feedback_replies for insert with check (
  logged_by = auth.uid()
  and public.app_role() in ('superadmin','national_admin','lgu_admin')
);

create policy feedback_replies_delete on public.feedback_replies for delete using (
  public.app_is_national_admin()
  or logged_by = auth.uid()
);

do $$ begin
  alter publication supabase_realtime add table public.feedback_replies;
exception when duplicate_object then null; end $$;
