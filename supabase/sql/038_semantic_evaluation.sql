begin;

create extension if not exists vector;

alter table public.question_scores
  add column if not exists original_ai_score numeric,
  add column if not exists teacher_override_score numeric,
  add column if not exists override_reason text,
  add column if not exists overridden_by uuid references public.users(id) on delete set null,
  add column if not exists overridden_at timestamptz,
  add column if not exists needs_review boolean not null default false,
  add column if not exists review_reasons jsonb not null default '[]'::jsonb,
  add column if not exists alignment_confidence numeric,
  add column if not exists question_text text,
  add column if not exists model_answer text,
  add column if not exists student_answer_present boolean not null default true,
  add column if not exists topic text,
  add column if not exists subtopic text,
  add column if not exists bloom_level text,
  add column if not exists semantic_similarity numeric,
  add column if not exists llm_score numeric,
  add column if not exists student_lang text,
  add column if not exists model_lang text;

create table if not exists public.question_feedback (
  question_score_id uuid primary key references public.question_scores(id) on delete cascade,
  key_concepts_present jsonb not null default '[]'::jsonb,
  missed_concepts jsonb not null default '[]'::jsonb,
  factual_errors jsonb not null default '[]'::jsonb,
  structural_issues jsonb not null default '[]'::jsonb,
  improvement_areas jsonb not null default '[]'::jsonb,
  suggested_format text,
  exemplar_answer text,
  student_embedding vector(1024),
  model_embedding vector(1024),
  question_embedding vector(1024),
  created_at timestamptz not null default now()
);

create table if not exists public.grading_audit (
  id uuid primary key default gen_random_uuid(),
  question_score_id uuid references public.question_scores(id) on delete cascade,
  result_id uuid references public.results(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  actor_role text,
  action text not null check (action in ('ai_score','override','regrade','review_flag')),
  before_score numeric,
  after_score numeric,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.grading_jobs
  add column if not exists parent_grading_job_id uuid references public.grading_jobs(id) on delete set null,
  add column if not exists model_versions jsonb not null default '{}'::jsonb,
  add column if not exists token_usage jsonb not null default '{}'::jsonb,
  add column if not exists cost_estimate_inr numeric,
  add column if not exists degraded_mode boolean not null default false,
  add column if not exists stage_artifacts jsonb not null default '{}'::jsonb;

alter table public.answer_submissions
  add column if not exists regrade_count integer not null default 0,
  add column if not exists has_diagrams boolean not null default false;

alter table public.student_improvement_plans
  add column if not exists topic_breakdown jsonb not null default '[]'::jsonb;

create index if not exists idx_question_scores_needs_review
  on public.question_scores(needs_review) where needs_review = true;
create index if not exists idx_grading_audit_result
  on public.grading_audit(result_id);
create index if not exists idx_grading_audit_question_score
  on public.grading_audit(question_score_id);
create index if not exists idx_question_feedback_student_emb
  on public.question_feedback using ivfflat (student_embedding vector_cosine_ops) with (lists = 100);

alter table public.question_feedback enable row level security;
alter table public.grading_audit enable row level security;

drop policy if exists "question_feedback_select" on public.question_feedback;
create policy "question_feedback_select" on public.question_feedback
  for select to authenticated using (
    exists (
      select 1 from public.question_scores qs
      where qs.id = question_feedback.question_score_id
        and (
          public.is_admin()
          or public.can_manage_test(qs.test_id)
          or public.can_view_student(qs.student_id)
        )
    )
  );

drop policy if exists "question_feedback_insert" on public.question_feedback;
create policy "question_feedback_insert" on public.question_feedback
  for insert to authenticated with check (
    exists (
      select 1 from public.question_scores qs
      where qs.id = question_feedback.question_score_id
        and (public.is_admin() or public.can_manage_test(qs.test_id))
    )
  );

drop policy if exists "question_feedback_update" on public.question_feedback;
create policy "question_feedback_update" on public.question_feedback
  for update to authenticated
  using (
    exists (
      select 1 from public.question_scores qs
      where qs.id = question_feedback.question_score_id
        and (public.is_admin() or public.can_manage_test(qs.test_id))
    )
  )
  with check (
    exists (
      select 1 from public.question_scores qs
      where qs.id = question_feedback.question_score_id
        and (public.is_admin() or public.can_manage_test(qs.test_id))
    )
  );

drop policy if exists "question_feedback_delete" on public.question_feedback;
create policy "question_feedback_delete" on public.question_feedback
  for delete to authenticated using (
    exists (
      select 1 from public.question_scores qs
      where qs.id = question_feedback.question_score_id
        and (public.is_admin() or public.can_manage_test(qs.test_id))
    )
  );

drop policy if exists "grading_audit_select" on public.grading_audit;
create policy "grading_audit_select" on public.grading_audit
  for select to authenticated using (
    public.is_admin()
    or exists (
      select 1 from public.results r
      where r.id = grading_audit.result_id
        and (public.can_manage_test(r.test_id) or public.can_view_student(r.student_id))
    )
  );

drop policy if exists "grading_audit_insert" on public.grading_audit;
create policy "grading_audit_insert" on public.grading_audit
  for insert to authenticated with check (
    public.is_admin()
    or exists (
      select 1 from public.results r
      where r.id = grading_audit.result_id
        and public.can_manage_test(r.test_id)
    )
  );

commit;
