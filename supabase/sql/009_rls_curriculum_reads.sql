-- 009_rls_curriculum_reads.sql
-- Broaden reads so teachers can list all staff (CompareClasses) and all curriculum tests (ConductTest),
-- matching the SPA behavior that used shared in-memory data.

begin;

drop policy if exists teachers_select on public.teachers;
create policy teachers_select
on public.teachers
for select
to authenticated
using (true);

drop policy if exists tests_select on public.tests;
create policy tests_select
on public.tests
for select
to authenticated
using (
  public.is_admin()
  or public.is_teacher()
  or (
    public.is_student()
    and exists (
      select 1 from public.students s
      where s.user_id = auth.uid()
    )
  )
);

commit;
