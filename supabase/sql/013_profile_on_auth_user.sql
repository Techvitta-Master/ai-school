-- 013_profile_on_auth_user.sql
-- Inserts into public.profiles when a new auth user is created (runs as definer; bypasses RLS).
-- Fixes 401 on client POST /profiles when email confirmation leaves the browser without a session.

begin;

alter table public.profiles
  add column if not exists email text,
  add column if not exists role public.app_role;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.app_role;
begin
  if new.raw_user_meta_data is not null
     and (new.raw_user_meta_data->>'role') in ('admin', 'teacher', 'student')
  then
    r := (new.raw_user_meta_data->>'role')::public.app_role;
  else
    r := null;
  end if;

  insert into public.profiles (user_id, full_name, email, role)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data->>'full_name', '')), ''),
    new.email,
    r
  )
  on conflict (user_id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user_profile();

commit;
