-- 021_reset_minimal_portal_schema.sql
-- Hard reset to a minimal schema for the 4-role portal flow:
-- admin > school > teacher > student
--
-- IMPORTANT:
-- 1) This migration is destructive (drops existing app tables).
-- 2) It seeds only login-related master rows (no academic/sample scores seed).
-- 3) Supabase Auth credentials/passwords are stored in auth.users, not public tables.
--    Create auth users with these emails/passwords separately:
--      admin@school.com / 123456
--      school@school.com / 123456
--      priya@school.com / 123456
--      aarav.patel@student.com / 123456

begin;

-- ---------------------------------------------------------------------------
-- Drop existing app objects
-- ---------------------------------------------------------------------------
drop table if exists public.evaluations cascade;
drop table if exists public.answer_sheets cascade;
drop table if exists public.scores cascade;
drop table if exists public.tests cascade;
drop table if exists public.student_subject_teacher_assignments cascade;
drop table if exists public.teacher_section_assignments cascade;
drop table if exists public.students cascade;
drop table if exists public.teachers cascade;
drop table if exists public.sections cascade;
drop table if exists public.syllabus_chapters cascade;
drop table if exists public.syllabus_themes cascade;
drop table if exists public.user_roles cascade;
drop table if exists public.profiles cascade;
drop table if exists public.schools cascade;

drop function if exists public.sync_profile_role_to_user_roles() cascade;
drop function if exists public.handle_new_user_profile() cascade;
drop function if exists public.has_role(text) cascade;
drop function if exists public.is_admin() cascade;
drop function if exists public.is_school() cascade;
drop function if exists public.is_teacher() cascade;
drop function if exists public.is_student() cascade;

drop type if exists public.app_role cascade;

create type public.app_role as enum ('admin', 'school', 'teacher', 'student');

-- ---------------------------------------------------------------------------
-- Core tables
-- ---------------------------------------------------------------------------
create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text unique,
  role public.app_role,
  school_id uuid references public.schools(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null
);

create table public.syllabus_themes (
  id uuid primary key default gen_random_uuid(),
  theme_code text not null unique,
  title text not null,
  domain text
);

create table public.syllabus_chapters (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.syllabus_themes(id) on delete cascade,
  chapter_number int not null,
  title text not null,
  topics jsonb not null default '[]'::jsonb
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_name text not null,
  section_name text not null,
  strength int default 0,
  class_teacher_id uuid,
  unique (school_id, class_name, section_name)
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  phone text,
  subject text,
  experience int,
  education text,
  join_date date
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  roll_no text,
  section_id uuid references public.sections(id) on delete set null,
  assigned_teacher_id uuid references public.teachers(id) on delete set null,
  attendance numeric default 0,
  parent_name text,
  parent_phone text,
  address text
);

alter table public.sections
  add constraint sections_class_teacher_fk
  foreign key (class_teacher_id) references public.teachers(id) on delete set null;

create table public.teacher_section_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  subject text not null,
  unique (teacher_id, section_id, subject)
);

create table public.student_subject_teacher_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now(),
  unique (student_id, subject)
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid references public.schools(id) on delete set null,
  title text not null,
  theme_id uuid references public.syllabus_themes(id) on delete set null,
  chapter_id uuid references public.syllabus_chapters(id) on delete set null,
  domain text,
  topics jsonb not null default '[]'::jsonb,
  duration_minutes int,
  total_marks int not null default 100,
  test_type text default 'Chapter Test',
  created_by_teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  score numeric not null,
  topic_scores jsonb not null default '{}'::jsonb,
  feedback text,
  grade text,
  graded_by_teacher_id uuid references public.teachers(id) on delete set null,
  graded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, test_id)
);

create table public.answer_sheets (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  roll_no text,
  bucket text default 'answer-sheets',
  storage_path text default '',
  status text not null default 'uploaded',
  uploaded_by_teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.evaluations (
  id uuid primary key default gen_random_uuid(),
  answer_sheet_id uuid not null unique references public.answer_sheets(id) on delete cascade,
  marks numeric not null,
  grade text,
  feedback text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Role model helpers
-- ---------------------------------------------------------------------------
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
  )
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role::text = role_text
  );
$$;

create or replace function public.is_admin() returns boolean language sql stable as $$ select public.has_role('admin'); $$;
create or replace function public.is_school() returns boolean language sql stable as $$ select public.has_role('school'); $$;
create or replace function public.is_teacher() returns boolean language sql stable as $$ select public.has_role('teacher'); $$;
create or replace function public.is_student() returns boolean language sql stable as $$ select public.has_role('student'); $$;

-- ---------------------------------------------------------------------------
-- Access control mode
-- ---------------------------------------------------------------------------
-- RLS is intentionally disabled for all app tables.
-- Access is controlled in the Node API layer.
alter table public.schools disable row level security;
alter table public.profiles disable row level security;
alter table public.user_roles disable row level security;
alter table public.syllabus_themes disable row level security;
alter table public.syllabus_chapters disable row level security;
alter table public.sections disable row level security;
alter table public.teachers disable row level security;
alter table public.students disable row level security;
alter table public.teacher_section_assignments disable row level security;
alter table public.student_subject_teacher_assignments disable row level security;
alter table public.tests disable row level security;
alter table public.scores disable row level security;
alter table public.answer_sheets disable row level security;
alter table public.evaluations disable row level security;

-- ---------------------------------------------------------------------------
-- Login-only seed rows in app tables (no test/scores/sample workload)
-- ---------------------------------------------------------------------------
insert into public.schools (id, name)
values ('d0000000-0000-4000-8000-000000000001', 'Madavi Institute');

insert into public.teachers (id, school_id, name, email, subject)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'd0000000-0000-4000-8000-000000000001', 'Priya Sharma', 'priya@school.com', 'Social Science');

insert into public.students (id, school_id, name, email, roll_no)
values ('cccccccc-cccc-cccc-cccc-ccccccccccc1', 'd0000000-0000-4000-8000-000000000001', 'Aarav Patel', 'aarav.patel@student.com', '1');

commit;
