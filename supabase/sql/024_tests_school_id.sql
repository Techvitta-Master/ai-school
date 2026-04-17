-- 024_tests_school_id.sql
-- Ensure tests can be scoped to a school (safe if column already exists from 021).

begin;

alter table public.tests add column if not exists school_id uuid references public.schools(id) on delete set null;

commit;
