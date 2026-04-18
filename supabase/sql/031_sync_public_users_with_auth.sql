begin;

-- Seed SQL can insert public.users with ids that do not match Supabase Auth ids.
-- Align public.users.id (and dependent FKs) with auth.users.id by email so RLS matches auth.uid().
-- Inserts for auth-only accounts use raw_user_meta_data.role (from Auth admin API / Edge Functions).

do $$
declare
  r record;
begin
  for r in
    select c.conname, n.nspname, cl.relname as tablename
    from pg_constraint c
    join pg_class cl on cl.oid = c.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    where c.contype = 'f'
      and c.confrelid = 'public.users'::regclass
      and n.nspname = 'public'
      and cl.relname in ('teachers', 'students', 'schools')
  loop
    execute format('alter table %I.%I drop constraint %I', r.nspname, r.tablename, r.conname);
  end loop;
end $$;

alter table public.teachers
  add constraint teachers_user_id_fkey
  foreign key (user_id) references public.users (id)
  on delete cascade on update cascade;

alter table public.students
  add constraint students_user_id_fkey
  foreign key (user_id) references public.users (id)
  on delete cascade on update cascade;

alter table public.schools
  add constraint schools_created_by_fkey
  foreign key (created_by) references public.users (id)
  on delete set null on update cascade;

create or replace function public.sync_public_users_from_auth()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.users u
  set id = au.id
  from auth.users au
  where lower(trim(u.email)) = lower(trim(au.email::text))
    and u.id is distinct from au.id;

  insert into public.users (id, email, role)
  select
    au.id,
    trim(au.email::text),
    case lower(trim(coalesce(au.raw_user_meta_data->>'role', au.raw_app_meta_data->>'role', '')))
      when 'admin' then 'admin'::public.user_role
      when 'school' then 'school'::public.user_role
      when 'teacher' then 'teacher'::public.user_role
      when 'student' then 'student'::public.user_role
    end
  from auth.users au
  where au.email is not null
    and trim(au.email::text) <> ''
    and not exists (select 1 from public.users u where u.id = au.id)
    and not exists (
      select 1 from public.users u2 where lower(trim(u2.email)) = lower(trim(au.email::text))
    )
    and lower(trim(coalesce(au.raw_user_meta_data->>'role', au.raw_app_meta_data->>'role', ''))) in (
      'admin', 'school', 'teacher', 'student'
    );
end;
$$;

revoke all on function public.sync_public_users_from_auth() from public;
grant execute on function public.sync_public_users_from_auth() to service_role;

select public.sync_public_users_from_auth();

commit;
