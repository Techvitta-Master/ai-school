-- 019_evaluation_details.sql
-- Creates public.evaluations if it does not exist, then adds the grade and
-- details columns needed for full RCA output.
--
-- Safe to re-run — all statements use IF NOT EXISTS / IF NOT EXISTS guards.
-- Run after: 015_answer_sheets.sql (answer_sheets table must exist).

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Create evaluations table (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.evaluations (
  id              uuid          primary key default gen_random_uuid(),
  answer_sheet_id uuid          not null
                    references public.answer_sheets(id) on delete cascade
                    unique,
  marks           numeric(5,2)  not null check (marks >= 0 and marks <= 100),
  feedback        text          not null default '',
  evaluated_at    timestamptz   not null default now()
);

create index if not exists idx_evaluations_sheet_id
  on public.evaluations (answer_sheet_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add new RCA columns
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.evaluations
  add column if not exists grade   text,
  add column if not exists details jsonb not null default '{}'::jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.evaluations enable row level security;

-- Admin: full access
drop policy if exists evaluations_all_admin on public.evaluations;
create policy evaluations_all_admin
  on public.evaluations for all to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

-- Teacher SELECT: evaluations for answer sheets they uploaded
drop policy if exists evaluations_select_teacher on public.evaluations;
create policy evaluations_select_teacher
  on public.evaluations for select to authenticated
  using (
    public.is_teacher()
    and exists (
      select 1 from public.answer_sheets ans
      join  public.teachers t on t.id = ans.uploaded_by_teacher_id
      where ans.id = evaluations.answer_sheet_id
        and t.user_id = auth.uid()
    )
  );

-- Teacher INSERT / UPDATE: same scope as SELECT
drop policy if exists evaluations_write_teacher on public.evaluations;
create policy evaluations_write_teacher
  on public.evaluations for insert to authenticated
  with check (
    public.is_teacher()
    and exists (
      select 1 from public.answer_sheets ans
      join  public.teachers t on t.id = ans.uploaded_by_teacher_id
      where ans.id = evaluations.answer_sheet_id
        and t.user_id = auth.uid()
    )
  );

-- Student SELECT: own evaluations only
drop policy if exists evaluations_select_student on public.evaluations;
create policy evaluations_select_student
  on public.evaluations for select to authenticated
  using (
    public.is_student()
    and exists (
      select 1 from public.answer_sheets ans
      join  public.students s on s.id = ans.student_id
      where ans.id = evaluations.answer_sheet_id
        and s.user_id = auth.uid()
    )
  );

commit;
