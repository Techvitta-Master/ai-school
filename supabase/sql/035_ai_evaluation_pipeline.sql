begin;

create extension if not exists pgcrypto;

create or replace function public.can_manage_test(p_test_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.tests te
      join public.teachers t on t.id = te.created_by
      where te.id = p_test_id
        and (t.user_id = auth.uid() or public.is_school_admin(t.school_id))
    );
$$;

create or replace function public.can_view_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1 from public.students st
      where st.id = p_student_id and st.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.students st
      where st.id = p_student_id
        and (
          public.is_school_admin(st.school_id)
          or st.school_id = public.teacher_school_id()
        )
    );
$$;

grant execute on function public.can_manage_test(uuid) to authenticated;
grant execute on function public.can_view_student(uuid) to authenticated;

create table if not exists public.answer_submissions (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete restrict,
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  uploaded_by_teacher_id uuid references public.teachers(id) on delete set null,
  storage_bucket text not null default 'answer-sheets',
  question_paper_path text not null default '',
  answer_key_path text not null default '',
  student_answer_path text not null,
  mime_type text,
  status text not null default 'uploaded' check (status in ('uploaded', 'queued', 'processing', 'done', 'failed')),
  metadata jsonb not null default '{}'::jsonb,
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grading_jobs (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.answer_submissions(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'ocr', 'grading', 'plan', 'done', 'failed')),
  attempts integer not null default 0,
  idempotency_key text not null unique,
  model_config jsonb not null default '{}'::jsonb,
  error_message text,
  error_details jsonb,
  raw_ocr_path text,
  raw_llm_path text,
  result_id uuid references public.results(id) on delete set null,
  started_at timestamptz,
  finished_at timestamptz,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.question_scores (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results(id) on delete cascade,
  submission_id uuid not null references public.answer_submissions(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  question_no text not null,
  max_score numeric not null,
  score numeric not null,
  confidence numeric,
  extracted_answer text,
  evaluator_reasoning text,
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  rubric jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (result_id, question_no)
);

create table if not exists public.student_improvement_plans (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  test_id uuid not null references public.tests(id) on delete cascade,
  result_id uuid not null references public.results(id) on delete cascade,
  submission_id uuid references public.answer_submissions(id) on delete set null,
  plan_text text not null,
  weak_topics jsonb not null default '[]'::jsonb,
  tasks jsonb not null default '[]'::jsonb,
  model_version text,
  generated_by text not null default 'llm',
  generated_at timestamptz not null default now(),
  unique (student_id, test_id, result_id)
);

create index if not exists idx_answer_submissions_school on public.answer_submissions(school_id);
create index if not exists idx_answer_submissions_test on public.answer_submissions(test_id);
create index if not exists idx_answer_submissions_student on public.answer_submissions(student_id);
create index if not exists idx_grading_jobs_submission on public.grading_jobs(submission_id);
create index if not exists idx_grading_jobs_school_status on public.grading_jobs(school_id, status);
create index if not exists idx_question_scores_result on public.question_scores(result_id);
create index if not exists idx_question_scores_student_test on public.question_scores(student_id, test_id);
create index if not exists idx_improvement_plans_student on public.student_improvement_plans(student_id);
create index if not exists idx_improvement_plans_test on public.student_improvement_plans(test_id);

alter table public.answer_submissions enable row level security;
alter table public.grading_jobs enable row level security;
alter table public.question_scores enable row level security;
alter table public.student_improvement_plans enable row level security;

drop policy if exists "answer_submissions_select" on public.answer_submissions;
create policy "answer_submissions_select" on public.answer_submissions
  for select to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
    or public.can_view_student(student_id)
  );

drop policy if exists "answer_submissions_insert" on public.answer_submissions;
create policy "answer_submissions_insert" on public.answer_submissions
  for insert to authenticated
  with check (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "answer_submissions_update" on public.answer_submissions;
create policy "answer_submissions_update" on public.answer_submissions
  for update to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
  )
  with check (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "answer_submissions_delete" on public.answer_submissions;
create policy "answer_submissions_delete" on public.answer_submissions
  for delete to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "grading_jobs_select" on public.grading_jobs;
create policy "grading_jobs_select" on public.grading_jobs
  for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.answer_submissions s
      where s.id = grading_jobs.submission_id
        and (public.can_manage_test(s.test_id) or public.can_view_student(s.student_id))
    )
  );

drop policy if exists "grading_jobs_insert" on public.grading_jobs;
create policy "grading_jobs_insert" on public.grading_jobs
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.answer_submissions s
      where s.id = grading_jobs.submission_id
        and public.can_manage_test(s.test_id)
    )
  );

drop policy if exists "grading_jobs_update" on public.grading_jobs;
create policy "grading_jobs_update" on public.grading_jobs
  for update to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.answer_submissions s
      where s.id = grading_jobs.submission_id
        and public.can_manage_test(s.test_id)
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1
      from public.answer_submissions s
      where s.id = grading_jobs.submission_id
        and public.can_manage_test(s.test_id)
    )
  );

drop policy if exists "question_scores_select" on public.question_scores;
create policy "question_scores_select" on public.question_scores
  for select to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
    or public.can_view_student(student_id)
  );

drop policy if exists "question_scores_insert" on public.question_scores;
create policy "question_scores_insert" on public.question_scores
  for insert to authenticated
  with check (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "question_scores_update" on public.question_scores;
create policy "question_scores_update" on public.question_scores
  for update to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
  )
  with check (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "question_scores_delete" on public.question_scores;
create policy "question_scores_delete" on public.question_scores
  for delete to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "student_improvement_plans_select" on public.student_improvement_plans;
create policy "student_improvement_plans_select" on public.student_improvement_plans
  for select to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
    or public.can_view_student(student_id)
  );

drop policy if exists "student_improvement_plans_insert" on public.student_improvement_plans;
create policy "student_improvement_plans_insert" on public.student_improvement_plans
  for insert to authenticated
  with check (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "student_improvement_plans_update" on public.student_improvement_plans;
create policy "student_improvement_plans_update" on public.student_improvement_plans
  for update to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
  )
  with check (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

drop policy if exists "student_improvement_plans_delete" on public.student_improvement_plans;
create policy "student_improvement_plans_delete" on public.student_improvement_plans
  for delete to authenticated
  using (
    public.is_admin()
    or public.can_manage_test(test_id)
  );

commit;
