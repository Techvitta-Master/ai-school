-- 006_edge_function_support.sql
-- Purpose: Add helper SQL utilities for Edge Functions.

begin;

create or replace function public.get_teacher_id_for_auth_user(p_user_id uuid)
returns uuid
language sql
stable
as $$
  select t.id
  from public.teachers t
  where t.user_id = p_user_id
  limit 1;
$$;

create or replace function public.register_test_analysis(
  p_test_id uuid,
  p_bucket text,
  p_storage_path text,
  p_analysis jsonb default '{}'::jsonb
)
returns public.test_analyses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_teacher_id uuid;
  v_row public.test_analyses;
begin
  v_teacher_id := public.get_teacher_id_for_auth_user(auth.uid());

  if v_teacher_id is null and not public.is_admin() then
    raise exception 'Only teachers or admins can register analyses';
  end if;

  insert into public.test_analyses (
    test_id,
    uploaded_by_teacher_id,
    bucket,
    storage_path,
    analysis
  )
  values (
    p_test_id,
    v_teacher_id,
    p_bucket,
    p_storage_path,
    coalesce(p_analysis, '{}'::jsonb)
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace view public.v_test_analysis_context as
select
  ta.id as analysis_id,
  ta.test_id,
  t.title as test_title,
  t.domain,
  t.topics,
  ta.bucket,
  ta.storage_path,
  ta.analysis,
  ta.created_at
from public.test_analyses ta
join public.tests t on t.id = ta.test_id;

grant select on public.v_test_analysis_context to authenticated;
grant execute on function public.register_test_analysis(uuid, text, text, jsonb) to authenticated;
grant execute on function public.get_teacher_id_for_auth_user(uuid) to authenticated;

commit;

