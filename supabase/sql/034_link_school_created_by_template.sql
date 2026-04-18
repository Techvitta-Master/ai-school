begin;

-- Fix one school with NULL created_by: set owner to the school admin's public.users.id (= auth id).
-- Get school id from: select id, name, created_by from public.schools;
-- Get admin id from: select id, email, role from public.users where role = 'school';

update public.schools s
set created_by = u.id
from public.users u
where s.id = 'PASTE_SCHOOL_UUID'
  and s.created_by is null
  and u.role = 'school'::public.user_role
  and lower(trim(u.email)) = lower(trim('PASTE_SCHOOL_ADMIN_EMAIL'));

commit;
