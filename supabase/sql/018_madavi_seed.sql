-- 018_madavi_seed.sql
-- Seeds Madavi Institute as the primary single-school for this MVP deployment.
-- Creates all 10 class sections (classes 6-10, sections A and B each).
-- Links existing demo teachers and students to Madavi Institute.
--
-- SAFE TO RUN MULTIPLE TIMES (all inserts use ON CONFLICT DO NOTHING / DO UPDATE).
-- Run after: 014_schools_role.sql, 011_demo_seed.sql

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Madavi Institute in the schools master table
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.schools (id, name) values
  ('d0000000-0000-4000-8000-000000000001', 'Madavi Institute')
on conflict (id) do update set name = excluded.name;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Class sections 6-A through 10-B  (5 classes × 2 sections = 10 rows)
--    Using ON CONFLICT DO NOTHING so re-running this migration is safe even if
--    some sections already exist from demo seed (007/011).
-- ─────────────────────────────────────────────────────────────────────────────

insert into public.sections (class_name, section_name, strength) values
  ('6',  'A', 35),
  ('6',  'B', 35),
  ('7',  'A', 35),
  ('7',  'B', 35),
  ('8',  'A', 35),
  ('8',  'B', 35),
  ('9',  'A', 35),
  ('9',  'B', 35),
  ('10', 'A', 35),
  ('10', 'B', 35)
on conflict (class_name, section_name) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Link demo teachers to Madavi Institute
--    (ids are from 011_demo_seed.sql — Priya Sharma, Rajesh Kumar)
-- ─────────────────────────────────────────────────────────────────────────────

update public.teachers
set school_id = 'd0000000-0000-4000-8000-000000000001'
where id in (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Link demo students to Madavi Institute
--    (ids are from 011_demo_seed.sql — Aarav, Diya, Arjun)
-- ─────────────────────────────────────────────────────────────────────────────

update public.students
set school_id = 'd0000000-0000-4000-8000-000000000001'
where id in (
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'cccccccc-cccc-cccc-cccc-ccccccccccc2',
  'cccccccc-cccc-cccc-cccc-ccccccccccc3'
);

commit;
