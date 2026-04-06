-- 007_seed_minimal.sql
-- Purpose: Insert minimal non-sensitive sample data.
-- Notes:
-- 1) Create auth users first in Supabase Auth.
-- 2) Replace placeholder UUIDs below with real auth.users.id values.
-- 3) Re-run safely: inserts use `on conflict do nothing`.

begin;

-- Optional profile/role seeds (replace UUIDs before running).
-- insert into public.profiles (user_id, full_name)
-- values
--   ('00000000-0000-0000-0000-000000000001', 'Admin User'),
--   ('00000000-0000-0000-0000-000000000002', 'Teacher User'),
--   ('00000000-0000-0000-0000-000000000003', 'Student User')
-- on conflict (user_id) do nothing;
--
-- insert into public.user_roles (user_id, role)
-- values
--   ('00000000-0000-0000-0000-000000000001', 'admin'),
--   ('00000000-0000-0000-0000-000000000002', 'teacher'),
--   ('00000000-0000-0000-0000-000000000003', 'student')
-- on conflict (user_id, role) do nothing;

insert into public.sections (id, class_name, section_name)
values
  ('11111111-1111-1111-1111-111111111111', '6', 'A')
on conflict (id) do nothing;

insert into public.syllabus_themes (id, theme_code, title, domain)
values
  ('22222222-2222-2222-2222-222222222222', 'theme_geo_1', 'Our Earth and Globe', 'Social Science')
on conflict (id) do nothing;

insert into public.syllabus_chapters (id, theme_id, chapter_number, title, topics)
values
  (
    '33333333-3333-3333-3333-333333333333',
    '22222222-2222-2222-2222-222222222222',
    1,
    'The Earth in the Solar System',
    '["solar system", "planets", "earth"]'::jsonb
  )
on conflict (id) do nothing;

insert into public.teachers (id, name, email, phone, subject)
values
  ('44444444-4444-4444-4444-444444444444', 'Sample Teacher', 'sample.teacher@school.com', null, 'Social Science')
on conflict (id) do nothing;

insert into public.students (id, name, email, roll_no, section_id, assigned_teacher_id, attendance)
values
  (
    '55555555-5555-5555-5555-555555555555',
    'Sample Student',
    'sample.student@school.com',
    '1',
    '11111111-1111-1111-1111-111111111111',
    '44444444-4444-4444-4444-444444444444',
    92.5
  )
on conflict (id) do nothing;

insert into public.teacher_section_assignments (id, teacher_id, section_id, subject)
values
  (
    '66666666-6666-6666-6666-666666666666',
    '44444444-4444-4444-4444-444444444444',
    '11111111-1111-1111-1111-111111111111',
    'Social Science'
  )
on conflict (id) do nothing;

insert into public.tests (
  id, title, theme_id, chapter_id, domain, topics, duration_minutes, total_marks, created_by_teacher_id
)
values
  (
    '77777777-7777-7777-7777-777777777777',
    'Chapter 1 Assessment',
    '22222222-2222-2222-2222-222222222222',
    '33333333-3333-3333-3333-333333333333',
    'Social Science',
    '["solar system", "planets", "earth"]'::jsonb,
    60,
    100,
    '44444444-4444-4444-4444-444444444444'
  )
on conflict (id) do nothing;

insert into public.scores (id, student_id, test_id, score, topic_scores, graded_by_teacher_id)
values
  (
    '88888888-8888-8888-8888-888888888888',
    '55555555-5555-5555-5555-555555555555',
    '77777777-7777-7777-7777-777777777777',
    78,
    '{"solar system": 80, "planets": 75, "earth": 79}'::jsonb,
    '44444444-4444-4444-4444-444444444444'
  )
on conflict (id) do nothing;

commit;

