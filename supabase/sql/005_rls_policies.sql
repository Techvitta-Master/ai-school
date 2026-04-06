-- 005_rls_policies.sql
-- Purpose: Enable RLS and add role-aware policies.

begin;

create or replace function public.has_role(role_text text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role::text = role_text
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.has_role('admin');
$$;

create or replace function public.is_teacher()
returns boolean
language sql
stable
as $$
  select public.has_role('teacher');
$$;

create or replace function public.is_student()
returns boolean
language sql
stable
as $$
  select public.has_role('student');
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.sections enable row level security;
alter table public.teachers enable row level security;
alter table public.students enable row level security;
alter table public.teacher_section_assignments enable row level security;
alter table public.syllabus_themes enable row level security;
alter table public.syllabus_chapters enable row level security;
alter table public.tests enable row level security;
alter table public.scores enable row level security;
alter table public.test_analyses enable row level security;

-- Profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
on public.profiles
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert
on public.profiles
for insert
to authenticated
with check (public.is_admin() or user_id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update
on public.profiles
for update
to authenticated
using (public.is_admin() or user_id = auth.uid())
with check (public.is_admin() or user_id = auth.uid());

-- User roles
drop policy if exists user_roles_select on public.user_roles;
create policy user_roles_select
on public.user_roles
for select
to authenticated
using (public.is_admin() or user_id = auth.uid());

drop policy if exists user_roles_write_admin on public.user_roles;
create policy user_roles_write_admin
on public.user_roles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Sections and syllabus (read for all auth, write admin)
drop policy if exists sections_select on public.sections;
create policy sections_select
on public.sections
for select
to authenticated
using (true);

drop policy if exists sections_write_admin on public.sections;
create policy sections_write_admin
on public.sections
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists syllabus_themes_select on public.syllabus_themes;
create policy syllabus_themes_select
on public.syllabus_themes
for select
to authenticated
using (true);

drop policy if exists syllabus_themes_write_admin on public.syllabus_themes;
create policy syllabus_themes_write_admin
on public.syllabus_themes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists syllabus_chapters_select on public.syllabus_chapters;
create policy syllabus_chapters_select
on public.syllabus_chapters
for select
to authenticated
using (true);

drop policy if exists syllabus_chapters_write_admin on public.syllabus_chapters;
create policy syllabus_chapters_write_admin
on public.syllabus_chapters
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Teachers
drop policy if exists teachers_select on public.teachers;
create policy teachers_select
on public.teachers
for select
to authenticated
using (
  public.is_admin()
  or (public.is_teacher() and user_id = auth.uid())
  or public.is_student()
);

drop policy if exists teachers_write_admin on public.teachers;
create policy teachers_write_admin
on public.teachers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Students
drop policy if exists students_select on public.students;
create policy students_select
on public.students
for select
to authenticated
using (
  public.is_admin()
  or (public.is_student() and user_id = auth.uid())
  or (
    public.is_teacher()
    and exists (
      select 1 from public.teacher_section_assignments tsa
      join public.teachers t on t.id = tsa.teacher_id
      where tsa.section_id = students.section_id
        and t.user_id = auth.uid()
    )
  )
);

drop policy if exists students_write_admin on public.students;
create policy students_write_admin
on public.students
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Teacher-section assignments
drop policy if exists tsa_select on public.teacher_section_assignments;
create policy tsa_select
on public.teacher_section_assignments
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1 from public.teachers t
      where t.id = teacher_section_assignments.teacher_id
        and t.user_id = auth.uid()
    )
  )
  or public.is_student()
);

drop policy if exists tsa_write_admin on public.teacher_section_assignments;
create policy tsa_write_admin
on public.teacher_section_assignments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Tests
drop policy if exists tests_select on public.tests;
create policy tests_select
on public.tests
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1
      from public.teachers t
      where t.id = tests.created_by_teacher_id
        and t.user_id = auth.uid()
    )
  )
  or (
    public.is_student()
    and exists (
      select 1
      from public.students s
      where s.user_id = auth.uid()
    )
  )
);

drop policy if exists tests_insert_teacher_or_admin on public.tests;
create policy tests_insert_teacher_or_admin
on public.tests
for insert
to authenticated
with check (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1 from public.teachers t
      where t.id = tests.created_by_teacher_id
        and t.user_id = auth.uid()
    )
  )
);

drop policy if exists tests_update_teacher_or_admin on public.tests;
create policy tests_update_teacher_or_admin
on public.tests
for update
to authenticated
using (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1 from public.teachers t
      where t.id = tests.created_by_teacher_id
        and t.user_id = auth.uid()
    )
  )
)
with check (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1 from public.teachers t
      where t.id = tests.created_by_teacher_id
        and t.user_id = auth.uid()
    )
  )
);

drop policy if exists tests_delete_admin on public.tests;
create policy tests_delete_admin
on public.tests
for delete
to authenticated
using (public.is_admin());

-- Scores
drop policy if exists scores_select on public.scores;
create policy scores_select
on public.scores
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_student()
    and exists (
      select 1 from public.students s
      where s.id = scores.student_id
        and s.user_id = auth.uid()
    )
  )
  or (
    public.is_teacher()
    and exists (
      select 1
      from public.students s
      join public.teacher_section_assignments tsa on tsa.section_id = s.section_id
      join public.teachers t on t.id = tsa.teacher_id
      where s.id = scores.student_id
        and t.user_id = auth.uid()
    )
  )
);

drop policy if exists scores_write_teacher_or_admin on public.scores;
create policy scores_write_teacher_or_admin
on public.scores
for all
to authenticated
using (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1
      from public.students s
      join public.teacher_section_assignments tsa on tsa.section_id = s.section_id
      join public.teachers t on t.id = tsa.teacher_id
      where s.id = scores.student_id
        and t.user_id = auth.uid()
    )
  )
)
with check (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1
      from public.students s
      join public.teacher_section_assignments tsa on tsa.section_id = s.section_id
      join public.teachers t on t.id = tsa.teacher_id
      where s.id = scores.student_id
        and t.user_id = auth.uid()
    )
  )
);

-- Test analyses
drop policy if exists test_analyses_select on public.test_analyses;
create policy test_analyses_select
on public.test_analyses
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1
      from public.teachers t
      where t.id = test_analyses.uploaded_by_teacher_id
        and t.user_id = auth.uid()
    )
  )
  or public.is_student()
);

drop policy if exists test_analyses_write_teacher_or_admin on public.test_analyses;
create policy test_analyses_write_teacher_or_admin
on public.test_analyses
for all
to authenticated
using (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1
      from public.teachers t
      where t.id = test_analyses.uploaded_by_teacher_id
        and t.user_id = auth.uid()
    )
  )
)
with check (
  public.is_admin()
  or (
    public.is_teacher()
    and exists (
      select 1
      from public.teachers t
      where t.id = test_analyses.uploaded_by_teacher_id
        and t.user_id = auth.uid()
    )
  )
);

-- Storage policies for bucket `test-analyses`
drop policy if exists storage_test_analyses_read on storage.objects;
create policy storage_test_analyses_read
on storage.objects
for select
to authenticated
using (bucket_id = 'test-analyses');

drop policy if exists storage_test_analyses_insert on storage.objects;
create policy storage_test_analyses_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'test-analyses'
  and (public.is_admin() or public.is_teacher())
);

drop policy if exists storage_test_analyses_update on storage.objects;
create policy storage_test_analyses_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'test-analyses'
  and (public.is_admin() or public.is_teacher())
)
with check (
  bucket_id = 'test-analyses'
  and (public.is_admin() or public.is_teacher())
);

drop policy if exists storage_test_analyses_delete on storage.objects;
create policy storage_test_analyses_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'test-analyses'
  and (public.is_admin() or public.is_teacher())
);

commit;

