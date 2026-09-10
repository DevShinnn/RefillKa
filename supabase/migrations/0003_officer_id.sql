-- Officer login IDs (e.g. CENRO01). Auth still uses a mapped email internally.
alter table public.profiles
  add column if not exists officer_id text;

create unique index if not exists profiles_officer_id_uidx
  on public.profiles (officer_id)
  where officer_id is not null;

create or replace function public.handle_new_user()
  returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role, region_id, lgu_id, officer_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'cenro'),
    nullif(new.raw_user_meta_data->>'region_id', '')::uuid,
    nullif(new.raw_user_meta_data->>'lgu_id', '')::uuid,
    nullif(upper(trim(new.raw_user_meta_data->>'officer_id')), '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
