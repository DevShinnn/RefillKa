-- Service-role writes (ops PIN + store persist) must not be blocked by
-- protect_profile, which reads auth.uid() and sees null under the service key.
create or replace function public.protect_profile()
  returns trigger language plpgsql security definer set search_path = public
as $$
declare
  editor_role public.user_role := public.app_role();
  editor_lgu  uuid := public.app_lgu();
begin
  if auth.role() = 'service_role' then
    return new;
  end if;

  if (new.role = 'superadmin' or old.role = 'superadmin') and editor_role is distinct from 'superadmin' then
    raise exception 'Only a superadmin can manage superadmin accounts';
  end if;

  if editor_role in ('superadmin','national_admin') then
    return new;
  end if;

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
