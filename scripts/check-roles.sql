-- Check what's in user_roles vs profiles for all users
select
  p.user_id,
  p.email,
  p.role   as profile_role,
  ur.role  as user_roles_role
from public.profiles p
left join public.user_roles ur on ur.user_id = p.user_id
order by p.email;
