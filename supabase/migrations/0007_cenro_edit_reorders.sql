-- 0007_cenro_edit_reorders.sql
-- Allow CENRO field staff to edit and delete the reorders THEY logged,
-- within their assigned LGU. Admins keep their existing broader rights.
-- The before-insert stamp trigger only fires on INSERT, so logged_by /
-- logged_by_name are preserved across edits (the original collector stays).

drop policy if exists collections_update on public.collections;
create policy collections_update on public.collections for update
  using (
    public.app_is_national_admin()
    or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu())
    or (public.app_role() = 'cenro' and logged_by = auth.uid() and lgu_id = public.app_lgu())
  )
  with check (
    public.app_is_national_admin()
    or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu())
    or (public.app_role() = 'cenro' and logged_by = auth.uid() and lgu_id = public.app_lgu())
  );

drop policy if exists collections_delete on public.collections;
create policy collections_delete on public.collections for delete
  using (
    public.app_is_national_admin()
    or (public.app_role() = 'lgu_admin' and lgu_id = public.app_lgu())
    or (public.app_role() = 'cenro' and logged_by = auth.uid() and lgu_id = public.app_lgu())
  );
