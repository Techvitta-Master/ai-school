-- 014a_app_role_school_enum.sql
-- Run this script ALONE first (one execution in the SQL Editor), then run 014_schools_role.sql.
-- PostgreSQL requires the new enum value to be committed before it can appear in casts/policies.

do $$
begin
  alter type public.app_role add value 'school';
exception
  when duplicate_object then null;
end;
$$;
