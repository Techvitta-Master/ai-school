-- 012_profiles_registration_columns.sql
-- Adds optional columns for app registration (email + role snapshot on profiles).
-- Passwords must never be stored here; they live only as hashes in auth.users.

begin;

alter table public.profiles
  add column if not exists email text,
  add column if not exists role public.app_role;

commit;
