-- 015_evaluations.sql
-- Purpose: Answer sheets and dummy AI evaluation tables.

begin;

-- Stores each uploaded answer sheet (one per student per test).
create table if not exists public.answer_sheets (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  uploaded_by_teacher_id uuid references public.teachers(id) on delete set null,
  storage_path text,
  created_at timestamptz not null default now(),
  unique (test_id, student_id)
);

-- Stores the dummy AI evaluation result for each answer sheet.
create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  answer_sheet_id uuid not null references public.answer_sheets(id) on delete cascade unique,
  marks numeric(5,2) not null check (marks >= 0 and marks <= 100),
  feedback text not null,
  evaluated_at timestamptz not null default now()
);

create index if not exists idx_answer_sheets_test_id    on public.answer_sheets(test_id);
create index if not exists idx_answer_sheets_student_id on public.answer_sheets(student_id);
create index if not exists idx_evaluations_sheet_id     on public.evaluations(answer_sheet_id);

-- RLS
alter table public.answer_sheets enable row level security;
alter table public.evaluations    enable row level security;

-- answer_sheets: teachers see their own uploads; students see their own; admin sees all
drop policy if exists answer_sheets_select on public.answer_sheets;
create policy answer_sheets_select
on public.answer_sheets for select to authenticated
using (
  public.is_admin()
  or (public.is_teacher() and exists (
        select 1 from public.teachers t
        where t.id = answer_sheets.uploaded_by_teacher_id and t.user_id = auth.uid()))
  or (public.is_student() and exists (
        select 1 from public.students s
        where s.id = answer_sheets.student_id and s.user_id = auth.uid()))
);

drop policy if exists answer_sheets_insert on public.answer_sheets;
create policy answer_sheets_insert
on public.answer_sheets for insert to authenticated
with check (
  public.is_admin()
  or (public.is_teacher() and exists (
        select 1 from public.teachers t
        where t.id = answer_sheets.uploaded_by_teacher_id and t.user_id = auth.uid()))
);

-- evaluations: same read visibility as answer_sheets; write via teacher/admin
drop policy if exists evaluations_select on public.evaluations;
create policy evaluations_select
on public.evaluations for select to authenticated
using (
  public.is_admin()
  or exists (
    select 1 from public.answer_sheets ans
    join public.teachers t on t.id = ans.uploaded_by_teacher_id
    where ans.id = evaluations.answer_sheet_id and t.user_id = auth.uid())
  or exists (
    select 1 from public.answer_sheets ans
    join public.students s on s.id = ans.student_id
    where ans.id = evaluations.answer_sheet_id and s.user_id = auth.uid())
);

drop policy if exists evaluations_insert on public.evaluations;
create policy evaluations_insert
on public.evaluations for insert to authenticated
with check (
  public.is_admin()
  or exists (
    select 1 from public.answer_sheets ans
    join public.teachers t on t.id = ans.uploaded_by_teacher_id
    where ans.id = evaluations.answer_sheet_id and t.user_id = auth.uid())
);

commit;
