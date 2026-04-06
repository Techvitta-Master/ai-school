-- 011_demo_seed.sql
-- Demo dataset: sections, teachers, students, assignments, tests, scores.
-- Apply after 010_syllabus_seed. If you already ran 007_seed_minimal.sql, this uses ON CONFLICT / subqueries so rows merge by business keys.
-- Create Auth users for priya@school.com, rajesh@school.com, aarav.patel@student.com, etc., then link user_id + user_roles.

begin;

insert into public.sections (class_name, section_name, strength)
values
  ('6', 'A', 30),
  ('6', 'B', 30),
  ('7', 'A', 30),
  ('8', 'A', 30)
on conflict (class_name, section_name) do update set strength = excluded.strength;

insert into public.teachers (id, name, email, phone, subject, experience, education, join_date)
values
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    'Priya Sharma',
    'priya@school.com',
    '9876543210',
    'Social Science',
    8,
    'M.A. History',
    '2016-07-15'
  ),
  (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
    'Rajesh Kumar',
    'rajesh@school.com',
    '9876543211',
    'Mathematics',
    12,
    'M.Sc. Mathematics',
    '2012-06-01'
  )
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  phone = excluded.phone,
  subject = excluded.subject;

insert into public.students (
  id,
  name,
  email,
  roll_no,
  section_id,
  attendance,
  assigned_teacher_id,
  parent_name,
  parent_phone,
  address
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc1',
  'Aarav Patel',
  'aarav.patel@student.com',
  '1',
  s.id,
  92,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'Rajesh Patel',
  '9876543001',
  '1, MG Road, New Delhi'
from public.sections s
where s.class_name = '6' and s.section_name = 'A'
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  section_id = excluded.section_id,
  assigned_teacher_id = excluded.assigned_teacher_id;

insert into public.students (
  id,
  name,
  email,
  roll_no,
  section_id,
  attendance,
  assigned_teacher_id,
  parent_name,
  parent_phone,
  address
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc2',
  'Diya Singh',
  'diya.singh@student.com',
  '2',
  s.id,
  88,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
  'Priya Singh',
  '9876543002',
  '2, Civil Lines, Mumbai'
from public.sections s
where s.class_name = '6' and s.section_name = 'A'
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  section_id = excluded.section_id,
  assigned_teacher_id = excluded.assigned_teacher_id;

insert into public.students (
  id,
  name,
  email,
  roll_no,
  section_id,
  attendance,
  assigned_teacher_id,
  parent_name,
  parent_phone,
  address
)
select
  'cccccccc-cccc-cccc-cccc-ccccccccccc3',
  'Arjun Nair',
  'arjun.nair@student.com',
  '1',
  s.id,
  90,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
  'Vikram Nair',
  '9876543003',
  '3, Model Town, Bangalore'
from public.sections s
where s.class_name = '6' and s.section_name = 'B'
on conflict (id) do update set
  name = excluded.name,
  email = excluded.email,
  section_id = excluded.section_id,
  assigned_teacher_id = excluded.assigned_teacher_id;

insert into public.teacher_section_assignments (teacher_id, section_id, subject)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1', s.id, 'Social Science'
from public.sections s where s.class_name = '6' and s.section_name = 'A'
on conflict (teacher_id, section_id, subject) do nothing;

insert into public.teacher_section_assignments (teacher_id, section_id, subject)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', s.id, 'Mathematics'
from public.sections s where s.class_name = '6' and s.section_name = 'A'
on conflict (teacher_id, section_id, subject) do nothing;

insert into public.teacher_section_assignments (teacher_id, section_id, subject)
select 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2', s.id, 'Mathematics'
from public.sections s where s.class_name = '6' and s.section_name = 'B'
on conflict (teacher_id, section_id, subject) do nothing;

update public.sections s
set class_teacher_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'
where s.class_name = '6' and s.section_name = 'A';

insert into public.tests (
  id,
  title,
  theme_id,
  chapter_id,
  domain,
  topics,
  duration_minutes,
  total_marks,
  test_type,
  created_by_teacher_id
)
select
  'dddddddd-dddd-dddd-dddd-dddddddddddd1',
  'Locating Places on the Earth - Geo',
  st.id,
  sc.id,
  st.domain,
  sc.topics,
  45,
  100,
  'Chapter Test',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid
from public.syllabus_themes st
join public.syllabus_chapters sc on sc.theme_id = st.id and sc.chapter_number = 1
where st.theme_code = 'A'
limit 1
on conflict (id) do update set title = excluded.title;

insert into public.tests (
  id,
  title,
  theme_id,
  chapter_id,
  domain,
  topics,
  duration_minutes,
  total_marks,
  test_type,
  created_by_teacher_id
)
select
  'dddddddd-dddd-dddd-dddd-dddddddddddd2',
  'Oceans and Continents - Geo',
  st.id,
  sc.id,
  st.domain,
  sc.topics,
  50,
  100,
  'Weekly Test',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid
from public.syllabus_themes st
join public.syllabus_chapters sc on sc.theme_id = st.id and sc.chapter_number = 2
where st.theme_code = 'A'
limit 1
on conflict (id) do update set title = excluded.title;

insert into public.scores (student_id, test_id, score, topic_scores)
values
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc1',
    'dddddddd-dddd-dddd-dddd-dddddddddddd1',
    72,
    '{}'::jsonb
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc2',
    'dddddddd-dddd-dddd-dddd-dddddddddddd1',
    68,
    '{}'::jsonb
  ),
  (
    'cccccccc-cccc-cccc-cccc-ccccccccccc3',
    'dddddddd-dddd-dddd-dddd-dddddddddddd2',
    81,
    '{}'::jsonb
  )
on conflict (student_id, test_id) do update set score = excluded.score;

commit;
