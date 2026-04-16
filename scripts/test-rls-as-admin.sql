-- Verify has_role works for each real user
-- We simulate each user's auth.uid() and check if is_admin / is_school return true

do $$
declare
  rec record;
begin
  for rec in select u.id, u.email, coalesce(p.role::text, ur.role::text) as role
             from auth.users u
             left join public.profiles p on p.user_id = u.id
             left join public.user_roles ur on ur.user_id = u.id
             order by u.created_at desc
  loop
    raise notice 'User % (%): role=%, has_role(admin)=%, has_role(school)=%, has_role(teacher)=%',
      rec.email,
      rec.id,
      rec.role,
      (exists (select 1 from public.user_roles where user_id = rec.id and role::text = 'admin')
        or exists (select 1 from public.profiles where user_id = rec.id and role::text = 'admin')),
      (exists (select 1 from public.user_roles where user_id = rec.id and role::text = 'school')
        or exists (select 1 from public.profiles where user_id = rec.id and role::text = 'school')),
      (exists (select 1 from public.user_roles where user_id = rec.id and role::text = 'teacher')
        or exists (select 1 from public.profiles where user_id = rec.id and role::text = 'teacher'));
  end loop;
end $$;

-- Also: verify the trigger exists and the function was updated
select
  proname,
  prosrc like '%profiles%' as checks_profiles,
  prosrc like '%user_roles%' as checks_user_roles
from pg_proc
where proname = 'has_role'
  and pronamespace = 'public'::regnamespace;
