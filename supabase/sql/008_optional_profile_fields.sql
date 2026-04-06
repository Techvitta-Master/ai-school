-- 008_optional_profile_fields.sql
-- Optional UI fields: teacher bios, student contacts, section metadata, test display type.

begin;

alter table public.teachers
  add column if not exists experience int,
  add column if not exists education text,
  add column if not exists join_date date;

alter table public.students
  add column if not exists parent_name text,
  add column if not exists parent_phone text,
  add column if not exists address text;

alter table public.sections
  add column if not exists strength int,
  add column if not exists class_teacher_id uuid references public.teachers(id) on delete set null;

alter table public.tests
  add column if not exists test_type text;

commit;
