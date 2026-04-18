begin;

create extension if not exists pgcrypto;

drop table if exists public.results cascade;
drop table if exists public.tests cascade;
drop table if exists public.students cascade;
drop table if exists public.teachers cascade;
drop table if exists public.subjects cascade;
drop table if exists public.classes cascade;
drop table if exists public.schools cascade;
drop table if exists public.users cascade;

drop table if exists public.student_subject_teacher_assignments cascade;
drop table if exists public.teacher_class_assignments cascade;

drop type if exists public.user_role cascade;

create type public.user_role as enum ('admin', 'school', 'teacher', 'student');

create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  role public.user_role not null,
  created_at timestamptz not null default now()
);

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (school_id, name)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  name text not null,
  email text not null unique,
  roll_no text,
  created_at timestamptz not null default now()
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject_id uuid not null references public.subjects(id) on delete restrict,
  class_id uuid not null references public.classes(id) on delete restrict,
  created_by uuid not null references public.teachers(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (subject_id, class_id, name)
);

create table public.results (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  marks numeric not null,
  percentage numeric,
  created_at timestamptz not null default now(),
  unique (student_id, test_id)
);

create index idx_users_email on public.users(email);
create index idx_students_class_id on public.students(class_id);
create index idx_teachers_subject_id on public.teachers(subject_id);
create index idx_tests_subject_id on public.tests(subject_id);
create index idx_results_student_id on public.results(student_id);
create index idx_results_test_id on public.results(test_id);

-- Seed data (fixed UUIDs, minimal demo rows)
-- Insert order: users -> school -> class -> subject -> teacher -> student
insert into public.users (id, email, role)
values
  ('10000000-0000-0000-0000-000000000001', 'admin@school.com', 'admin'),
  ('10000000-0000-0000-0000-000000000002', 'school@school.com', 'school'),
  ('10000000-0000-0000-0000-000000000003', 'priya@school.com', 'teacher'),
  ('10000000-0000-0000-0000-000000000004', 'aarav.patel@student.com', 'student')
on conflict do nothing;

-- School portal user must be created_by so is_school_admin() passes RLS (admin still has full access via is_admin()).
insert into public.schools (id, name, created_by)
values ('20000000-0000-0000-0000-000000000001', 'Madavi Institute', '10000000-0000-0000-0000-000000000002')
on conflict do nothing;

insert into public.classes (id, school_id, name)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Class 6')
on conflict do nothing;

insert into public.subjects (id, school_id, name)
values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Social Science')
on conflict do nothing;

insert into public.teachers (id, user_id, school_id, subject_id, name, email)
values (
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'Priya Sharma',
  'priya@school.com'
)
on conflict do nothing;

insert into public.students (id, user_id, school_id, class_id, name, email, roll_no)
values (
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  '20000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000001',
  'Aarav Patel',
  'aarav.patel@student.com',
  '1'
)
on conflict do nothing;

commit;
