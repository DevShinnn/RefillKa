-- ₱550 × 9 weeks starting Friday 11 Sep 2026 (Fri–Thu weeks).
-- Keep the installment Friday sent by the app; do not snap week_start
-- to paid_on, so a late payment still counts for the week it belongs to.

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

  if new.week_start is null then
    -- last Friday on or before paid_on (DOW: 0 Sun … 5 Fri)
    new.week_start := (new.paid_on - ((extract(dow from new.paid_on)::int + 2) % 7))::date;
  end if;

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
