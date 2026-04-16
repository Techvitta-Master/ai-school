-- 015_answer_sheets.sql
-- Purpose: Per-student answer sheet uploads + evaluation fields on scores.
-- Run after: 005_rls_policies.sql

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. answer_sheets: one upload record per student per test
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.answer_sheets (
  id                      uuid        primary key default gen_random_uuid(),
  test_id                 uuid        not null references public.tests(id) on delete cascade,
  student_id              uuid        references public.students(id) on delete set null,
  roll_no                 text,
  bucket                  text        not null default 'answer-sheets',
  storage_path            text        not null default '',
  status                  text        not null default 'uploaded'
                            check (status in ('uploaded', 'processing', 'evaluated')),
  uploaded_by_teacher_id  uuid        references public.teachers(id) on delete set null,
  created_at              timestamptz not null default now()
);

-- In Postgres, NULL != NULL in UNIQUE constraints, so multiple NULL student_ids
-- are still allowed (for unlinked sheets). PostgREST can use this for onConflict.
alter table public.answer_sheets
  drop constraint if exists uq_answer_sheets_student_test;
alter table public.answer_sheets
  add constraint uq_answer_sheets_student_test unique (student_id, test_id);

create index if not exists idx_answer_sheets_test_id
  on public.answer_sheets (test_id);

create index if not exists idx_answer_sheets_student_id
  on public.answer_sheets (student_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Extend scores with evaluation output fields
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.scores
  add column if not exists feedback   text,
  add column if not exists grade      text;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RLS for answer_sheets
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.answer_sheets enable row level security;

-- Admin: full access
drop policy if exists answer_sheets_all_admin on public.answer_sheets;
create policy answer_sheets_all_admin
  on public.answer_sheets
  for all
  to authenticated
  using  (public.is_admin())
  with check (public.is_admin());

-- Teacher SELECT: own uploads + students in their assigned sections
drop policy if exists answer_sheets_select_teacher on public.answer_sheets;
create policy answer_sheets_select_teacher
  on public.answer_sheets
  for select
  to authenticated
  using (
    public.is_teacher()
    and (
      uploaded_by_teacher_id in (
        select id from public.teachers where user_id = auth.uid()
      )
      or
      student_id in (
        select s.id
        from public.students s
        join public.teacher_section_assignments tsa on tsa.section_id = s.section_id
        join public.teachers t on t.id = tsa.teacher_id
        where t.user_id = auth.uid()
      )
    )
  );

-- Teacher INSERT: only for themselves as uploader
drop policy if exists answer_sheets_insert_teacher on public.answer_sheets;
create policy answer_sheets_insert_teacher
  on public.answer_sheets
  for insert
  to authenticated
  with check (
    public.is_teacher()
    and uploaded_by_teacher_id in (
      select id from public.teachers where user_id = auth.uid()
    )
  );

-- Teacher UPDATE: own uploads only
drop policy if exists answer_sheets_update_teacher on public.answer_sheets;
create policy answer_sheets_update_teacher
  on public.answer_sheets
  for update
  to authenticated
  using (
    public.is_teacher()
    and uploaded_by_teacher_id in (
      select id from public.teachers where user_id = auth.uid()
    )
  )
  with check (
    public.is_teacher()
    and uploaded_by_teacher_id in (
      select id from public.teachers where user_id = auth.uid()
    )
  );

-- Student SELECT: own answer sheets only
drop policy if exists answer_sheets_select_student on public.answer_sheets;
create policy answer_sheets_select_student
  on public.answer_sheets
  for select
  to authenticated
  using (
    public.is_student()
    and student_id in (
      select id from public.students where user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Storage policies for the 'answer-sheets' bucket
--    (Create the bucket manually in Supabase Dashboard or via API)
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists storage_answer_sheets_read on storage.objects;
create policy storage_answer_sheets_read
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'answer-sheets');

drop policy if exists storage_answer_sheets_insert on storage.objects;
create policy storage_answer_sheets_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'answer-sheets'
    and (public.is_admin() or public.is_teacher())
  );

-- Required for upsert (replace file)
drop policy if exists storage_answer_sheets_update on storage.objects;
create policy storage_answer_sheets_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'answer-sheets'
    and (public.is_admin() or public.is_teacher())
  )
  with check (
    bucket_id = 'answer-sheets'
    and (public.is_admin() or public.is_teacher())
  );

drop policy if exists storage_answer_sheets_delete on storage.objects;
create policy storage_answer_sheets_delete
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'answer-sheets'
    and (public.is_admin() or public.is_teacher())
  );

commit;
