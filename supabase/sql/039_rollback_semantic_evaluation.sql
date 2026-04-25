begin;

drop policy if exists "grading_audit_insert" on public.grading_audit;
drop policy if exists "grading_audit_select" on public.grading_audit;
drop policy if exists "question_feedback_delete" on public.question_feedback;
drop policy if exists "question_feedback_update" on public.question_feedback;
drop policy if exists "question_feedback_insert" on public.question_feedback;
drop policy if exists "question_feedback_select" on public.question_feedback;

drop index if exists public.idx_question_feedback_student_emb;
drop index if exists public.idx_grading_audit_question_score;
drop index if exists public.idx_grading_audit_result;
drop index if exists public.idx_question_scores_needs_review;

drop table if exists public.grading_audit cascade;
drop table if exists public.question_feedback cascade;

alter table public.student_improvement_plans
  drop column if exists topic_breakdown;

alter table public.answer_submissions
  drop column if exists has_diagrams,
  drop column if exists regrade_count;

alter table public.grading_jobs
  drop column if exists stage_artifacts,
  drop column if exists degraded_mode,
  drop column if exists cost_estimate_inr,
  drop column if exists token_usage,
  drop column if exists model_versions,
  drop column if exists parent_grading_job_id;

alter table public.question_scores
  drop column if exists model_lang,
  drop column if exists student_lang,
  drop column if exists llm_score,
  drop column if exists semantic_similarity,
  drop column if exists bloom_level,
  drop column if exists subtopic,
  drop column if exists topic,
  drop column if exists student_answer_present,
  drop column if exists model_answer,
  drop column if exists question_text,
  drop column if exists alignment_confidence,
  drop column if exists review_reasons,
  drop column if exists needs_review,
  drop column if exists overridden_at,
  drop column if exists overridden_by,
  drop column if exists override_reason,
  drop column if exists teacher_override_score,
  drop column if exists original_ai_score;

commit;
