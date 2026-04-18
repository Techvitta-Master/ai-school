begin;

-- RLS: is_school_admin() requires schools.created_by = auth.uid() for that school admin.
-- If legacy seed pointed created_by at the wrong user, fix only when ownership is unambiguous:
-- exactly one school row and exactly one school-role user in public.users.

update public.schools s
set created_by = su.id
from public.users su
where su.role = 'school'::public.user_role
  and (select count(*) from public.schools) = 1
  and (select count(*) from public.users where role = 'school'::public.user_role) = 1
  and s.created_by is distinct from su.id;

commit;
