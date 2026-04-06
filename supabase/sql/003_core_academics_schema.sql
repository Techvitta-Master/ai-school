-- 003_core_academics_schema.sql
-- Purpose: Create normalized academic domain tables.

begin;

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  class_name text not null,
  section_name text not null,
  created_at timestamptz not null default now(),
  unique (class_name, section_name)
);

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  phone text,
  subject text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  roll_no text,
  section_id uuid references public.sections(id) on delete set null,
  attendance numeric(5,2) check (attendance is null or (attendance >= 0 and attendance <= 100)),
  assigned_teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(section_id, roll_no)
);

create table if not exists public.teacher_section_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teachers(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now(),
  unique (teacher_id, section_id, subject)
);

create table if not exists public.syllabus_themes (
  id uuid primary key default gen_random_uuid(),
  theme_code text not null unique,
  title text not null,
  domain text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.syllabus_chapters (
  id uuid primary key default gen_random_uuid(),
  theme_id uuid not null references public.syllabus_themes(id) on delete cascade,
  chapter_number int not null,
  title text not null,
  topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (theme_id, chapter_number)
);

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  theme_id uuid references public.syllabus_themes(id) on delete set null,
  chapter_id uuid references public.syllabus_chapters(id) on delete set null,
  domain text,
  topics jsonb not null default '[]'::jsonb,
  duration_minutes int check (duration_minutes is null or duration_minutes > 0),
  total_marks numeric(6,2) check (total_marks is null or total_marks > 0),
  created_by_teacher_id uuid references public.teachers(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scores (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  score numeric(6,2) not null check (score >= 0 and score <= 100),
  topic_scores jsonb not null default '{}'::jsonb,
  graded_by_teacher_id uuid references public.teachers(id) on delete set null,
  graded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, test_id)
);

create table if not exists public.test_analyses (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  uploaded_by_teacher_id uuid references public.teachers(id) on delete set null,
  bucket text not null,
  storage_path text not null,
  analysis jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sections_class_section on public.sections(class_name, section_name);
create index if not exists idx_students_section_id on public.students(section_id);
create index if not exists idx_students_teacher_id on public.students(assigned_teacher_id);
create index if not exists idx_tsa_teacher_id on public.teacher_section_assignments(teacher_id);
create index if not exists idx_tsa_section_id on public.teacher_section_assignments(section_id);
create index if not exists idx_tests_created_by on public.tests(created_by_teacher_id);
create index if not exists idx_scores_student_id on public.scores(student_id);
create index if not exists idx_scores_test_id on public.scores(test_id);
create index if not exists idx_test_analyses_test_id on public.test_analyses(test_id);

drop trigger if exists trg_teachers_set_updated_at on public.teachers;
create trigger trg_teachers_set_updated_at
before update on public.teachers
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists trg_students_set_updated_at on public.students;
create trigger trg_students_set_updated_at
before update on public.students
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists trg_tests_set_updated_at on public.tests;
create trigger trg_tests_set_updated_at
before update on public.tests
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists trg_scores_set_updated_at on public.scores;
create trigger trg_scores_set_updated_at
before update on public.scores
for each row
execute function public.set_timestamp_updated_at();

commit;

