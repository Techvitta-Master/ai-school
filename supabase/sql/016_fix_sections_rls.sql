-- 016_fix_sections_rls.sql
-- Problem: sections_write_admin policy only allows is_admin().
--          School-role users can add students but need to upsert sections first → 401.
-- Fix:     Add a write policy for school role, and a helper is_school() function.

begin;

-- Helper function (mirrors is_admin / is_teacher pattern)
create or replace function public.is_school()
returns boolean
language sql
stable
security definer
as $$
  select public.has_role('school');
$$;

-- Allow school-role users to insert / update sections that belong to their school context.
-- Sections don't have a school_id FK (they're global), so we just check the role.
-- This is safe: school users can only see their own students/teachers (enforced elsewhere).
drop policy if exists sections_write_school on public.sections;
create policy sections_write_school
on public.sections
for all
to authenticated
using   (public.is_admin() or public.is_school())
with check (public.is_admin() or public.is_school());

commit;
