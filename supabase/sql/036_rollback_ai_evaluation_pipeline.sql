begin;

drop table if exists public.student_improvement_plans cascade;
drop table if exists public.question_scores cascade;
drop table if exists public.grading_jobs cascade;
drop table if exists public.answer_submissions cascade;

drop function if exists public.can_manage_test(uuid);
drop function if exists public.can_view_student(uuid);

commit;
