-- List all Supabase Auth users and their app roles
select
  u.id,
  u.email,
  u.raw_user_meta_data->>'role' as meta_role,
  p.role                        as profile_role,
  ur.role                       as user_roles_role,
  u.created_at
from auth.users u
left join public.profiles p  on p.user_id  = u.id
left join public.user_roles ur on ur.user_id = u.id
order by u.created_at desc;
