begin;

-- Helper predicates (SECURITY DEFINER avoids RLS recursion on users)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role = 'admin'
  );
$$;

create or replace function public.is_school_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.schools s
    where s.id = p_school_id and s.created_by = auth.uid()
  ) or public.is_admin();
$$;

create or replace function public.teacher_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select t.school_id from public.teachers t where t.user_id = auth.uid() limit 1;
$$;

create or replace function public.student_school_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select s.school_id from public.students s where s.user_id = auth.uid() limit 1;
$$;

grant execute on function public.is_admin() to authenticated, anon;
grant execute on function public.is_school_admin(uuid) to authenticated, anon;
grant execute on function public.teacher_school_id() to authenticated, anon;
grant execute on function public.student_school_id() to authenticated, anon;

-- Enable RLS
alter table public.users enable row level security;
alter table public.schools enable row level security;
alter table public.classes enable row level security;
alter table public.subjects enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.tests enable row level security;
alter table public.results enable row level security;
alter table public.teacher_classes enable row level security;

-- users
drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin" on public.users
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists "users_modify_admin" on public.users;
create policy "users_modify_admin" on public.users
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- schools (anon read for registration)
drop policy if exists "schools_select_all" on public.schools;
create policy "schools_select_all" on public.schools
  for select using (true);

drop policy if exists "schools_insert_admin" on public.schools;
create policy "schools_insert_admin" on public.schools
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists "schools_update_scope" on public.schools;
create policy "schools_update_scope" on public.schools
  for update to authenticated
  using (public.is_admin() or created_by = auth.uid())
  with check (public.is_admin() or created_by = auth.uid());

drop policy if exists "schools_delete_admin" on public.schools;
create policy "schools_delete_admin" on public.schools
  for delete to authenticated
  using (public.is_admin());

-- classes
drop policy if exists "classes_select" on public.classes;
create policy "classes_select" on public.classes
  for select to authenticated
  using (
    public.is_admin()
    or public.is_school_admin(school_id)
    or school_id = public.teacher_school_id()
    or school_id = public.student_school_id()
  );

drop policy if exists "classes_write_school" on public.classes;
create policy "classes_write_school" on public.classes
  for all to authenticated
  using (public.is_school_admin(school_id) or public.is_admin())
  with check (public.is_school_admin(school_id) or public.is_admin());

-- subjects
drop policy if exists "subjects_select" on public.subjects;
create policy "subjects_select" on public.subjects
  for select to authenticated
  using (
    public.is_admin()
    or public.is_school_admin(school_id)
    or school_id = public.teacher_school_id()
    or school_id = public.student_school_id()
  );

drop policy if exists "subjects_write_school" on public.subjects;
create policy "subjects_write_school" on public.subjects
  for all to authenticated
  using (public.is_school_admin(school_id) or public.is_admin())
  with check (public.is_school_admin(school_id) or public.is_admin());

-- teachers
drop policy if exists "teachers_select" on public.teachers;
create policy "teachers_select" on public.teachers
  for select to authenticated
  using (
    public.is_admin()
    or public.is_school_admin(school_id)
    or user_id = auth.uid()
    or school_id = public.teacher_school_id()
    or school_id = public.student_school_id()
  );

drop policy if exists "teachers_update_self" on public.teachers;
create policy "teachers_update_self" on public.teachers
  for update to authenticated
  using (user_id = auth.uid() or public.is_school_admin(school_id) or public.is_admin())
  with check (user_id = auth.uid() or public.is_school_admin(school_id) or public.is_admin());

-- students
drop policy if exists "students_select" on public.students;
create policy "students_select" on public.students
  for select to authenticated
  using (
    public.is_admin()
    or public.is_school_admin(school_id)
    or user_id = auth.uid()
    or school_id = public.teacher_school_id()
  );

drop policy if exists "students_update" on public.students;
create policy "students_update" on public.students
  for update to authenticated
  using (
    public.is_admin()
    or public.is_school_admin(school_id)
    or (school_id = public.teacher_school_id())
  )
  with check (
    public.is_admin()
    or public.is_school_admin(school_id)
    or (school_id = public.teacher_school_id())
  );

-- tests
drop policy if exists "tests_select" on public.tests;
create policy "tests_select" on public.tests
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.teachers t
      where t.id = tests.created_by
        and (t.user_id = auth.uid() or public.is_school_admin(t.school_id))
    )
    or exists (
      select 1 from public.students st
      join public.classes c on c.id = tests.class_id
      where st.user_id = auth.uid() and st.class_id = c.id
    )
  );

drop policy if exists "tests_insert_teacher" on public.tests;
create policy "tests_insert_teacher" on public.tests
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.teachers t
      where t.id = tests.created_by and t.user_id = auth.uid()
    )
  );

drop policy if exists "tests_update_teacher" on public.tests;
create policy "tests_update_teacher" on public.tests
  for update to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.teachers t where t.id = tests.created_by and t.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (select 1 from public.teachers t where t.id = tests.created_by and t.user_id = auth.uid())
  );

drop policy if exists "tests_delete_teacher" on public.tests;
create policy "tests_delete_teacher" on public.tests
  for delete to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.teachers t where t.id = tests.created_by and t.user_id = auth.uid())
  );

-- results
drop policy if exists "results_select" on public.results;
create policy "results_select" on public.results
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.students st where st.id = results.student_id and st.user_id = auth.uid())
    or exists (
      select 1 from public.tests te
      join public.teachers t on t.id = te.created_by
      where te.id = results.test_id and (t.user_id = auth.uid() or public.is_school_admin(t.school_id))
    )
  );

drop policy if exists "results_insert" on public.results;
create policy "results_insert" on public.results
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.tests te
      join public.teachers t on t.id = te.created_by
      where te.id = results.test_id and t.user_id = auth.uid()
    )
  );

drop policy if exists "results_update" on public.results;
create policy "results_update" on public.results
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tests te
      join public.teachers t on t.id = te.created_by
      where te.id = results.test_id and t.user_id = auth.uid()
    )
    or exists (select 1 from public.students st where st.id = results.student_id and st.user_id = auth.uid())
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.tests te
      join public.teachers t on t.id = te.created_by
      where te.id = results.test_id and t.user_id = auth.uid()
    )
    or exists (select 1 from public.students st where st.id = results.student_id and st.user_id = auth.uid())
  );

drop policy if exists "results_delete" on public.results;
create policy "results_delete" on public.results
  for delete to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.tests te
      join public.teachers t on t.id = te.created_by
      where te.id = results.test_id and t.user_id = auth.uid()
    )
  );

-- teacher_classes
drop policy if exists "teacher_classes_select" on public.teacher_classes;
create policy "teacher_classes_select" on public.teacher_classes
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.teachers t
      where t.id = teacher_classes.teacher_id
        and (t.user_id = auth.uid() or public.is_school_admin(t.school_id))
    )
    or exists (
      select 1 from public.classes c
      where c.id = teacher_classes.class_id
        and (public.is_school_admin(c.school_id) or c.school_id = public.student_school_id())
    )
  );

drop policy if exists "teacher_classes_write" on public.teacher_classes;
create policy "teacher_classes_write" on public.teacher_classes
  for all to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.teachers t
      where t.id = teacher_classes.teacher_id and public.is_school_admin(t.school_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.teachers t
      where t.id = teacher_classes.teacher_id and public.is_school_admin(t.school_id)
    )
  );

commit;
