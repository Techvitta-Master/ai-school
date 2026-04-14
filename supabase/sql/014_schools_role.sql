-- 014_schools_role.sql
-- Adds schools table, school_id on profiles/teachers/students, trigger updates, and RLS.
-- Prerequisite: run 014a_app_role_school_enum.sql first (separate execution) so enum value "school" is committed.

begin;

-- 1) Schools master list
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

insert into public.schools (id, name) values
  ('a0000001-0000-4000-8000-000000000001', 'Riverside International School'),
  ('a0000002-0000-4000-8000-000000000002', 'Green Valley Academy'),
  ('a0000003-0000-4000-8000-000000000003', 'St. Mary''s Convent School'),
  ('a0000004-0000-4000-8000-000000000004', 'Delhi Public School — North Campus'),
  ('a0000005-0000-4000-8000-000000000005', 'Oakwood Senior Secondary School'),
  ('a0000006-0000-4000-8000-000000000006', 'Sunrise Matriculation Higher Secondary')
on conflict (id) do update set name = excluded.name;

-- 2) Foreign keys
alter table public.profiles
  add column if not exists school_id uuid references public.schools(id) on delete set null;

alter table public.teachers
  add column if not exists school_id uuid references public.schools(id) on delete set null;

alter table public.students
  add column if not exists school_id uuid references public.schools(id) on delete set null;

create index if not exists idx_teachers_school_id on public.teachers(school_id);
create index if not exists idx_students_school_id on public.students(school_id);
create index if not exists idx_profiles_school_id on public.profiles(school_id);

-- 3) Auth trigger: persist role + school_id from signup metadata
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.app_role;
  sid uuid;
begin
  if new.raw_user_meta_data is not null
     and (new.raw_user_meta_data->>'role') in ('admin', 'teacher', 'student', 'school')
  then
    r := (new.raw_user_meta_data->>'role')::public.app_role;
  else
    r := null;
  end if;

  begin
    sid := nullif(trim(coalesce(new.raw_user_meta_data->>'school_id', '')), '')::uuid;
  exception
    when invalid_text_representation then
      sid := null;
  end;

  insert into public.profiles (user_id, full_name, email, role, school_id)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    new.email,
    r,
    sid
  )
  on conflict (user_id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    school_id = excluded.school_id,
    updated_at = now();

  return new;
end;
$$;

-- 4) RLS: schools readable for signup dropdown (anon) and app
alter table public.schools enable row level security;

drop policy if exists schools_select_public on public.schools;
create policy schools_select_public
on public.schools
for select
to anon, authenticated
using (true);

-- 5) School org accounts: read teachers/students/scores/tests for their school
drop policy if exists teachers_select_school on public.teachers;
create policy teachers_select_school
on public.teachers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and teachers.school_id = p.school_id
  )
);

drop policy if exists teachers_write_school on public.teachers;
create policy teachers_write_school
on public.teachers
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and teachers.school_id = p.school_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and teachers.school_id = p.school_id
  )
);

drop policy if exists students_select_school on public.students;
create policy students_select_school
on public.students
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and students.school_id = p.school_id
  )
);

drop policy if exists students_write_school on public.students;
create policy students_write_school
on public.students
for all
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and students.school_id = p.school_id
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and students.school_id = p.school_id
  )
);

drop policy if exists scores_select_school on public.scores;
create policy scores_select_school
on public.scores
for select
to authenticated
using (
  exists (
    select 1
    from public.students st
    join public.profiles p on p.user_id = auth.uid()
    where st.id = scores.student_id
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and st.school_id = p.school_id
  )
);

drop policy if exists tests_select_school on public.tests;
create policy tests_select_school
on public.tests
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'school'::public.app_role
  )
);

drop policy if exists test_analyses_select_school on public.test_analyses;
create policy test_analyses_select_school
on public.test_analyses
for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'school'::public.app_role
  )
);

drop policy if exists tsa_select_school on public.teacher_section_assignments;
create policy tsa_select_school
on public.teacher_section_assignments
for select
to authenticated
using (
  exists (
    select 1
    from public.teachers t
    join public.profiles p on p.user_id = auth.uid()
    where t.id = teacher_section_assignments.teacher_id
      and p.role = 'school'::public.app_role
      and p.school_id is not null
      and t.school_id = p.school_id
  )
);

commit;
