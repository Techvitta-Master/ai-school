-- Back-fill profiles for auth users who are missing one,
-- and sync their role to user_roles.

-- Step 1: insert missing profiles from auth.users metadata
insert into public.profiles (user_id, email, role)
select
  u.id,
  u.email,
  case
    when (u.raw_user_meta_data->>'role') in ('admin','teacher','student','school')
    then (u.raw_user_meta_data->>'role')::public.app_role
    else null
  end
from auth.users u
where not exists (
  select 1 from public.profiles p where p.user_id = u.id
)
on conflict (user_id) do update
  set
    email = excluded.email,
    role  = coalesce(profiles.role, excluded.role);

-- Step 2: sync all profiles with a role into user_roles
insert into public.user_roles (user_id, role)
select p.user_id, p.role
from public.profiles p
where p.role is not null
on conflict (user_id) do update set role = excluded.role;

-- Confirm full state
select
  u.email,
  p.role   as profile_role,
  ur.role  as user_roles_role,
  case when p.role is not null and p.role = ur.role then '✓ synced'
       when p.role is null then '— no profile role'
       else '✗ mismatch' end as status
from auth.users u
left join public.profiles p   on p.user_id  = u.id
left join public.user_roles ur on ur.user_id = u.id
order by u.created_at desc;
